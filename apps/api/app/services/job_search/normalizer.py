"""Normalize, dedup, score, and cap external job listings (US-073, decision 0025).

Results returned here are TRANSIENT — not persisted until the user clicks Save
(US-077). The pre-score is a ranking signal only; the AI relevance score is
added by the US-074 enrichment step.
"""

from __future__ import annotations

from typing import Any

from app.services.ai.ai_role_relevance_prefilter import compute_prefilter_score
from app.services.job_search.provider import ProviderJob

_MAX_DESCRIPTION_CHARS = 4_000


def normalize_and_rank(
    provider_jobs: list[ProviderJob],
    *,
    prefilter_limit: int,
) -> tuple[list[dict[str, Any]], int]:
    """Normalize, dedup, pre-score, sort, and cap provider results.

    Returns ``(jobs, total_ai_related)`` where:
    - ``jobs`` is sorted by pre_score desc and capped at ``prefilter_limit``
    - ``total_ai_related`` is the pre-cap count of likely-AI jobs (shown in the
      response so the UI can display "X of Y results are AI-related")
    """
    seen: set[str] = set()
    normalized: list[dict[str, Any]] = []
    for pj in provider_jobs:
        if pj.external_id in seen:
            continue
        seen.add(pj.external_id)
        normalized.append(_to_dict(pj))

    for job in normalized:
        pre = compute_prefilter_score({"title": job["title"], "raw_description": job["description"]})
        job["pre_score"] = pre["pre_score"]
        job["likely_ai_related"] = pre["likely_ai_related"]
        job["keyword_hits"] = pre["keyword_hits"]

    total_ai_related = sum(1 for j in normalized if j["likely_ai_related"])
    normalized.sort(key=lambda j: j["pre_score"], reverse=True)
    return normalized[:prefilter_limit], total_ai_related


def _to_dict(pj: ProviderJob) -> dict[str, Any]:
    return {
        "external_job_id": pj.external_id,
        "external_source": pj.external_source,
        "title": pj.title,
        "company": pj.company,
        "location": pj.location,
        "description": (pj.description or "")[:_MAX_DESCRIPTION_CHARS],
        "apply_url": pj.apply_url,
        "pre_score": 0,
        "likely_ai_related": False,
        "keyword_hits": [],
    }
