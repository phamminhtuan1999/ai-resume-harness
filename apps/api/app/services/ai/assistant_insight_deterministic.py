"""Deterministic job assistant insight — the typed fallback for ``assistant_insight``.

Runs when no ``gemini_api_key`` is configured or Gemini fails after retries. It
derives a schema-valid insight purely from the saved match analysis scores and
recommendation, so the card still works without a model.
"""

from __future__ import annotations

from typing import Any

from app.schemas.assistant_insight import (
    INSIGHT_LABEL,
    NEXT_ACTION_BY_RECOMMENDATION,
    match_to_insight_recommendation,
    score_to_risk_level,
)

DETERMINISTIC_CONFIDENCE = 0.6


def build_assistant_insight(*, match_analysis: dict[str, Any], job_title: str) -> dict:
    """Return a Feature 8.4 ``AssistantInsightOutput``-shaped dict (no model call)."""
    overall = int(match_analysis.get("overall_score") or 0)
    apply_recommendation = match_analysis.get("apply_recommendation")
    recommendation = match_to_insight_recommendation(apply_recommendation, overall)
    risk_level = score_to_risk_level(overall)
    label = INSIGHT_LABEL[recommendation]

    why = (
        match_analysis.get("fit_reasoning")
        or match_analysis.get("assistant_summary")
        or f"Based on an overall match of {overall}%."
    )
    strategy = (
        match_analysis.get("next_best_action")
        or "Emphasize your strongest evidenced skills and address the top gaps honestly."
    )

    return {
        "assistant_summary": (
            f"ApplyWise rates {job_title} a {overall}% match and recommends: "
            f"{label.lower()}."
        ),
        "recommendation": recommendation,
        "why_this_recommendation": why,
        "next_best_action": NEXT_ACTION_BY_RECOMMENDATION[recommendation],
        "application_strategy": strategy,
        "risk_level": risk_level,
        "confidence_score": DETERMINISTIC_CONFIDENCE,
    }
