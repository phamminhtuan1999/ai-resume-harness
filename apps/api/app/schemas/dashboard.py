"""Dashboard AI summary output schema (US-036, Feature 9.4).

One cross-job synthesis per user: best-fit role types, skill gaps that repeat
across jobs, an overall health band, and next actions. ``not_enough_data`` is a
valid health value but is normally produced by the pre-flight data gate (no
model call), not by the model itself.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.ai_workflow import AIOutputBase

JobSearchHealth = Literal["strong", "moderate", "weak", "not_enough_data"]

# Verbatim §9.6 data-gate copy; the UI must render this exactly.
NOT_ENOUGH_DATA_MESSAGE = (
    "ApplyWise needs more analyzed jobs before giving a strong pattern-based "
    "recommendation. Add or import at least 3 jobs to unlock a stronger "
    "dashboard summary."
)

# Fewer completed match/gap analyses than this -> data gate, no model call.
MIN_ANALYZED_JOBS = 3


class DashboardSummaryOutput(AIOutputBase):
    dashboard_summary: str = ""
    best_fit_roles: list[str] = Field(default_factory=list)
    repeated_skill_gaps: list[str] = Field(default_factory=list)
    job_search_health: JobSearchHealth = "not_enough_data"
    recommended_next_actions: list[str] = Field(default_factory=list)


def not_enough_data_result() -> dict:
    """The §9.4 early-return payload (no run row, no model call)."""
    return {
        "job_search_health": "not_enough_data",
        "dashboard_summary": "",
        "best_fit_roles": [],
        "repeated_skill_gaps": [],
        "recommended_next_actions": [],
        "confidence_score": 0.0,
    }
