"""Cost-safe search result enrichment: AI relevance + quick match (US-074).

Pipeline (enforced server-side; client cannot raise these limits):
  normalized jobs (≤JOB_SEARCH_PREFILTER_LIMIT, from US-073)
  → AI relevance on ALL (default tier, up to prefilter_limit = 20)
  → separate visible (score ≥60) from hidden (score <60)
  → quick match on top JOB_SEARCH_QUICK_MATCH_LIMIT visible jobs (fast tier)

In-memory cache (keyed by content hash) avoids re-spending model calls when
the same external listing appears in back-to-back searches. The cache is
injectable so tests can verify it is used (zero re-calls on second run).
"""

from __future__ import annotations

import hashlib
from typing import Any

from app.schemas.ai_role_relevance import AiRoleRelevanceOutput
from app.schemas.quick_match import QuickMatchOutput
from app.services.ai.ai_role_relevance_deterministic import deterministic_ai_relevance
from app.services.ai.ai_role_relevance_prefilter import compute_prefilter_score
from app.services.ai.model_routing import resolve_model
from app.services.ai.prompting import with_preamble
from app.services.ai.providers import ProviderError, build_primary_provider
from app.services.ai.quick_match_deterministic import (
    compute_pre_score,
    deterministic_quick_match,
    job_structured_signals,
)

# Decision 0025 thresholds.
POSSIBLE_THRESHOLD = 60
STRONG_THRESHOLD = 75

_MAX_JD_CHARS = 6_000


class SearchEnricher:
    """Enriches normalized search results with AI relevance + quick match."""

    def __init__(
        self,
        *,
        settings: Any,
        gemini_client: Any | None = None,
    ) -> None:
        self._settings = settings
        self._gemini_client = gemini_client

    def enrich(
        self,
        jobs: list[dict[str, Any]],
        *,
        profile: dict[str, Any] | None,
        quick_match_limit: int,
        relevance_threshold: int = POSSIBLE_THRESHOLD,
        cache: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Enrich jobs in-place with ai_relevance + quick_match, return sorted list.

        All jobs receive ai_relevance. Quick match runs only on top
        ``quick_match_limit`` visible jobs. Jobs below the relevance threshold
        get ``hidden=True`` and ``quick_match=None``.
        """
        if cache is None:
            cache = {}

        for job in jobs:
            key = _relevance_key(job)
            if key not in cache:
                cache[key] = self._run_relevance(job)
            job["ai_relevance"] = cache[key]
            score = job["ai_relevance"].get("ai_relevance_score", 0)
            job["hidden"] = score < relevance_threshold

        visible = [j for j in jobs if not j.get("hidden")]
        hidden = [j for j in jobs if j.get("hidden")]

        for j in hidden:
            j["quick_match"] = None

        for idx, job in enumerate(visible):
            if idx >= quick_match_limit:
                job["quick_match"] = None
                continue
            key = _qm_key(job, profile)
            if key not in cache:
                cache[key] = self._run_quick_match(job, profile)
            job["quick_match"] = cache[key]

        return visible + hidden

    def _run_relevance(self, job: dict[str, Any]) -> dict[str, Any]:
        job_proxy = _with_raw_description(job)
        return run_relevance_preview(
            job_proxy, settings=self._settings, client=self._gemini_client
        )

    def _run_quick_match(
        self, job: dict[str, Any], profile: dict[str, Any] | None
    ) -> dict[str, Any]:
        if not profile:
            return _unavailable_quick_match()

        job_proxy = _with_raw_description(job)
        signals = job_structured_signals(job_proxy)
        pre_score = compute_pre_score(profile=profile, job=job_proxy)
        prompt = _quick_match_prompt(job_proxy, profile, signals, pre_score)

        output: QuickMatchOutput | None = None
        try:
            model = resolve_model("quick_match", self._settings)
            provider = build_primary_provider(
                prompt=prompt,
                output_model=QuickMatchOutput,
                settings=self._settings,
                model=model,
                client=self._gemini_client,
            )
            if provider is not None:
                raw = provider.generate()
                output = QuickMatchOutput.model_validate(raw)
        except (ProviderError, Exception):
            pass

        if output is None:
            det = deterministic_quick_match(profile=profile, job=job_proxy)
            output = QuickMatchOutput.model_validate(det)

        ai_score = job.get("ai_relevance", {}).get("ai_relevance_score", 0)
        return _map_quick_match(output, ai_score)


# ---------------------------------------------------------------------------
# Shared relevance runner (used by the enricher AND the preview endpoints US-076)
# ---------------------------------------------------------------------------


def run_relevance_preview(
    job: dict[str, Any],
    *,
    settings: Any,
    client: Any | None = None,
) -> dict[str, Any]:
    """Run AI Role Relevance on an unsaved job dict and return the snapshot.

    The single source of truth for relevance-without-a-saved-row: the search
    enricher (US-074) and the URL/paste preview endpoints (US-076) both call it.
    ``job`` must carry ``title``, ``company`` and ``raw_description``. Falls back
    to the deterministic classifier on any provider error, so a preview always
    has a relevance result to show.
    """
    pre = compute_prefilter_score(
        {
            "title": job.get("title", ""),
            "raw_description": job.get("raw_description", ""),
        }
    )
    prompt = _relevance_prompt(job, pre)

    try:
        model = resolve_model("ai_role_relevance", settings)
        provider = build_primary_provider(
            prompt=prompt,
            output_model=AiRoleRelevanceOutput,
            settings=settings,
            model=model,
            client=client,
        )
        if provider is not None:
            raw = provider.generate()
            return AiRoleRelevanceOutput.model_validate(raw).model_dump(mode="json")
    except (ProviderError, Exception):
        pass

    return deterministic_ai_relevance(job)


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------


def _relevance_prompt(job: dict[str, Any], pre: dict[str, Any]) -> str:
    title = str(job.get("title") or "").strip()
    company = str(job.get("company") or "").strip()
    jd = str(job.get("raw_description") or "").strip()[:_MAX_JD_CHARS]
    detected = ", ".join(pre["keyword_hits"][:12]) or "(none)"

    task = f"""\
Task: Classify this job for AI engineering relevance.

Focus: Is this a meaningful AI engineering role for a software engineer
transitioning to an Applied AI Engineer path? This is about the job itself —
NOT any specific candidate.

Return JSON with EXACTLY these fields:
{{
  "is_ai_related": true/false,
  "ai_relevance_score": 0-100,
  "ai_role_category": "<value from list>",
  "transition_friendliness": "high" | "medium" | "low",
  "research_heavy": true/false,
  "engineering_focused": true/false,
  "relevance_reason": "<one sentence>",
  "detected_ai_keywords": ["keyword1", ...],
  "exclude_reason": null or "<value from list>",
  "confidence_score": 0.0-1.0
}}

ai_role_category: applied_ai_engineer | llm_engineer | generative_ai_engineer |
ai_product_engineer | ai_platform_engineer | backend_ai_engineer |
fullstack_ai_engineer | ml_engineer | ml_research | ai_adjacent_engineering |
not_ai_engineering | non_engineering_ai | unknown

exclude_reason (null when is_ai_related is true):
not_ai_related | non_engineering_ai_role | research_heavy_role |
data_or_analytics_role | generic_software_role | insufficient_job_data

Scoring: >=75 strong AI role, 60-74 possibly AI-related, <60 not meaningfully AI-related.

Pre-filter detected: {detected}
Job title: {title}
Company: {company}

Description (may be truncated):
---
{jd}
---
"""
    return with_preamble(task)


def _quick_match_prompt(
    job: dict[str, Any],
    profile: dict[str, Any],
    signals: dict[str, Any],
    pre: dict[str, Any],
) -> str:
    skills = ", ".join(signals["required_skills"][:10]) or "(none listed)"
    local_hint = f"local pre-score tier '{pre['tier']}'"
    jd = str(job.get("raw_description") or "").strip()[:_MAX_JD_CHARS]

    task = f"""\
Task: Quick first read on candidate-job fit. Be brief — this is a preview, not
a full analysis. Do not overstate.

Return JSON:
- likelihood: "strong" | "promising" | "weak"
- headline: ONE short honest sentence (second person, max 20 words)
- confidence_score: 0..1

Candidate:
- Target role: {profile.get('target_role') or '(unknown)'}
- Current role: {profile.get('current_role') or '(unknown)'}
- Years experience: {profile.get('years_of_experience') or '(unknown)'}
- Background: {(profile.get('technical_background') or '(unknown)')[:500]}

Job:
- Title: {signals['title'] or '(unknown)'}
- Required skills: {skills}
- Location: {signals['location'] or '(unknown)'}
- Local estimate: {local_hint} — refine it.

Description (may be truncated):
---
{jd}
---
"""
    return with_preamble(task)


# ---------------------------------------------------------------------------
# Mapping helpers
# ---------------------------------------------------------------------------


_LIKELIHOOD_SCORE: dict[str, int] = {"strong": 82, "promising": 62, "weak": 28}
_LIKELIHOOD_LABEL: dict[str, str] = {
    "strong": "strong",
    "promising": "possible",
    "weak": "weak",
}


def _recommended_action(likelihood: str, ai_relevance_score: int) -> str:
    if likelihood == "strong":
        return "save_and_analyze"
    if likelihood == "promising" and ai_relevance_score >= STRONG_THRESHOLD:
        return "save_and_analyze"
    if likelihood == "promising":
        return "save_for_later"
    if ai_relevance_score >= POSSIBLE_THRESHOLD:
        return "use_as_learning_target"
    return "skip"


def _map_quick_match(output: QuickMatchOutput, ai_relevance_score: int) -> dict[str, Any]:
    likelihood = output.likelihood
    return {
        "preview_match_score": _LIKELIHOOD_SCORE.get(likelihood, 40),
        "match_label": _LIKELIHOOD_LABEL.get(likelihood, "possible"),
        "assistant_preview": output.headline,
        "recommended_action": _recommended_action(likelihood, ai_relevance_score),
        "unavailable": False,
    }


def _unavailable_quick_match() -> dict[str, Any]:
    return {
        "preview_match_score": 0,
        "match_label": "limited_data",
        "assistant_preview": "Match preview unavailable.",
        "recommended_action": "save_for_later",
        "unavailable": True,
    }


# ---------------------------------------------------------------------------
# Cache key helpers
# ---------------------------------------------------------------------------


def _relevance_key(job: dict[str, Any]) -> str:
    text = f"{job.get('title', '')}|{job.get('description', '')}"
    return "rel:" + hashlib.sha256(text.encode()).hexdigest()[:16]


def _qm_key(job: dict[str, Any], profile: dict[str, Any] | None) -> str:
    job_text = f"{job.get('title', '')}|{job.get('description', '')}"
    prof_id = str((profile or {}).get("id", ""))
    prof_ts = str((profile or {}).get("updated_at", ""))
    return "qm:" + hashlib.sha256(f"{job_text}|{prof_id}:{prof_ts}".encode()).hexdigest()[:16]


def _with_raw_description(job: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of job with raw_description aliased from description."""
    return {**job, "raw_description": job.get("description", "")}
