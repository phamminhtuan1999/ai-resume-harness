"""Deterministic fallback for the AI Role Relevance classifier (US-072).

Produces a schema-valid ``AiRoleRelevanceOutput``-shaped dict from the pre-filter
result alone when the model is unavailable. The fallback never fabricates an AI
relevance score for a job with insufficient data.
"""

from __future__ import annotations

from typing import Any

from app.services.ai.ai_role_relevance_prefilter import compute_prefilter_score

_MIN_DESCRIPTION_CHARS = 80


def _has_sufficient_data(job: dict[str, Any]) -> bool:
    raw = str(job.get("raw_description") or "").strip()
    return len(raw) >= _MIN_DESCRIPTION_CHARS


def _infer_category(pre: dict[str, Any]) -> str:
    groups = pre["group_hits"]
    if groups.get("rag") or groups.get("llm"):
        return "llm_engineer"
    if groups.get("agents"):
        return "ai_product_engineer"
    if groups.get("ai_core"):
        return "applied_ai_engineer"
    return "not_ai_engineering"


def _infer_transition_friendliness(pre: dict[str, Any]) -> str:
    score = pre["pre_score"]
    if score >= 60:
        return "medium"
    if score >= 35:
        return "low"
    return "low"


def deterministic_ai_relevance(job: dict[str, Any]) -> dict[str, Any]:
    """Schema-shaped ``AiRoleRelevanceOutput`` dict with no model call.

    Called as ``deterministic_fallback`` by ``AiRoleRelevanceWorkflow``; also
    callable standalone by US-074 (search pipeline) when a pre-save job payload
    needs a fast relevance estimate without a workflow run.
    """
    if not _has_sufficient_data(job):
        return {
            "is_ai_related": False,
            "ai_relevance_score": 0,
            "ai_role_category": "unknown",
            "transition_friendliness": "low",
            "research_heavy": False,
            "engineering_focused": True,
            "relevance_reason": "Not enough job description data to assess AI relevance.",
            "detected_ai_keywords": [],
            "exclude_reason": "insufficient_job_data",
            "confidence_score": 0.2,
        }

    pre = compute_prefilter_score(job)
    score = pre["pre_score"]
    is_ai_related = pre["likely_ai_related"]

    if not is_ai_related:
        return {
            "is_ai_related": False,
            "ai_relevance_score": min(score, 55),
            "ai_role_category": "not_ai_engineering",
            "transition_friendliness": "low",
            "research_heavy": False,
            "engineering_focused": True,
            "relevance_reason": "No AI engineering keywords detected in the job description.",
            "detected_ai_keywords": [],
            "exclude_reason": "not_ai_related",
            "confidence_score": 0.45,
        }

    # AI-related: map pre-score to the thresholds buckets.
    # Deterministic fallback caps at 84 (just under the 75 strong threshold
    # + headroom); it's a hint, not the authoritative score.
    mapped_score = max(60, min(84, score))
    category = _infer_category(pre)
    transition = _infer_transition_friendliness(pre)

    return {
        "is_ai_related": True,
        "ai_relevance_score": mapped_score,
        "ai_role_category": category,
        "transition_friendliness": transition,
        "research_heavy": False,
        "engineering_focused": True,
        "relevance_reason": (
            f"Detected AI-related keywords: {', '.join(pre['keyword_hits'][:6])}."
            if pre["keyword_hits"]
            else "AI keywords found in the job listing."
        ),
        "detected_ai_keywords": pre["keyword_hits"][:10],
        "exclude_reason": None,
        "confidence_score": 0.45,
    }
