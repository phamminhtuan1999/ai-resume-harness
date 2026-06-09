"""Job assistant insight output schema (US-030, Feature 8.4).

A single decision-oriented recommendation per match — the main "AI assistant"
moment on the job detail page. The recommendation, risk level, and next best
action are derived server-side from the saved match analysis so the insight can
never contradict the score it summarizes; the model supplies the prose.
"""

from __future__ import annotations

from typing import Literal

from app.schemas.ai_workflow import AIOutputBase

InsightRecommendation = Literal[
    "apply_now", "tailor_resume_first", "build_project_first", "low_priority"
]
RiskLevel = Literal["low", "medium", "high"]

# US-028 apply recommendation -> insight recommendation (brief Story 8.1).
_APPLY_TO_INSIGHT: dict[str, InsightRecommendation] = {
    "apply_now": "apply_now",
    "apply_with_improvements": "tailor_resume_first",
    "improve_first": "build_project_first",
    "not_recommended": "low_priority",
}

# Each recommendation routes to one canonical next step (brief Story 8.1).
NEXT_ACTION_BY_RECOMMENDATION: dict[InsightRecommendation, str] = {
    "apply_now": "Review your application materials, then apply.",
    "tailor_resume_first": "Open resume suggestions and tailor your resume before applying.",
    "build_project_first": "Start the 4-week roadmap to build proof for the critical gaps.",
    "low_priority": "Deprioritize this role and focus on better-aligned roles.",
}

INSIGHT_LABEL: dict[InsightRecommendation, str] = {
    "apply_now": "Apply now",
    "tailor_resume_first": "Tailor resume first",
    "build_project_first": "Build project first",
    "low_priority": "Low priority",
}


class AssistantInsightOutput(AIOutputBase):
    assistant_summary: str = ""
    recommendation: InsightRecommendation = "tailor_resume_first"
    why_this_recommendation: str = ""
    next_best_action: str = ""
    application_strategy: str = ""
    risk_level: RiskLevel = "medium"


def match_to_insight_recommendation(
    apply_recommendation: str | None, overall_score: int
) -> InsightRecommendation:
    """Derive the insight recommendation from the saved match analysis.

    Prefers the US-028 ``apply_recommendation`` so the two never disagree; falls
    back to the overall-score band when it is absent.
    """
    if apply_recommendation in _APPLY_TO_INSIGHT:
        return _APPLY_TO_INSIGHT[apply_recommendation]
    if overall_score >= 75:
        return "apply_now"
    if overall_score >= 60:
        return "tailor_resume_first"
    if overall_score >= 40:
        return "build_project_first"
    return "low_priority"


def score_to_risk_level(overall_score: int) -> RiskLevel:
    """Lower scores carry more application risk. Bands mirror the score labels."""
    if overall_score >= 75:
        return "low"
    if overall_score >= 40:
        return "medium"
    return "high"
