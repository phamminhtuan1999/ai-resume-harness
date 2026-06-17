"""AI Role Relevance output schema (US-072, Period 16).

Classifies a job as AI-engineering-relevant — a judgment about the *job
itself*, separate from candidate fit. The full output matches Section 13 of
the intake spec; the snapshot lives in ``ai_workflow_runs.output_snapshot_json``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.ai_workflow import AIOutputBase

AiRoleCategory = Literal[
    "applied_ai_engineer",
    "llm_engineer",
    "generative_ai_engineer",
    "ai_product_engineer",
    "ai_platform_engineer",
    "backend_ai_engineer",
    "fullstack_ai_engineer",
    "ml_engineer",
    "ml_research",
    "ai_adjacent_engineering",
    "not_ai_engineering",
    "non_engineering_ai",
    "unknown",
]

TransitionFriendliness = Literal["high", "medium", "low"]

ExcludeReason = Literal[
    "not_ai_related",
    "non_engineering_ai_role",
    "research_heavy_role",
    "data_or_analytics_role",
    "generic_software_role",
    "insufficient_job_data",
]

# Display labels keyed by (is_ai_related, score bucket) for UI surfaces.
AI_RELEVANCE_LABEL: dict[str, str] = {
    "strong": "Strong AI match",
    "possible": "Possibly AI-related",
    "hidden": "Low AI relevance",
}


class AiRoleRelevanceOutput(AIOutputBase):
    """Structured output from the ai_role_relevance workflow."""

    is_ai_related: bool = False
    ai_relevance_score: int = Field(default=0, ge=0, le=100)
    ai_role_category: AiRoleCategory = "unknown"
    transition_friendliness: TransitionFriendliness = "low"
    research_heavy: bool = False
    engineering_focused: bool = True
    relevance_reason: str = ""
    detected_ai_keywords: list[str] = Field(default_factory=list)
    exclude_reason: ExcludeReason | None = None


def ai_relevance_label(score: int) -> str:
    if score >= 75:
        return "strong"
    if score >= 60:
        return "possible"
    return "hidden"
