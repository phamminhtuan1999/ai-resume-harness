"""Missing skill analysis output schema (US-029, Feature 2.4).

The deeper companion to the match analysis: every missing or weak skill is
classified by importance, gap type, and evidence status, with a concrete fix,
an optional project task, and the likely interview risk. Evidence status must be
grounded in the resume — the assistant never claims unevidenced proof.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai_workflow import AIOutputBase

Importance = Literal["critical", "medium", "nice_to_have"]
GapType = Literal["true_gap", "wording_gap", "proof_gap"]
EvidenceStatus = Literal["no_evidence", "weak_evidence", "strong_evidence"]

# Sort order so the UI and top_3 selection are deterministic.
IMPORTANCE_ORDER: dict[str, int] = {"critical": 0, "medium": 1, "nice_to_have": 2}


class MissingSkill(BaseModel):
    skill: str
    importance: Importance = "medium"
    gap_type: GapType = "true_gap"
    evidence_status: EvidenceStatus = "no_evidence"
    resume_evidence: str | None = None
    job_requirement: str = ""
    why_it_matters: str = ""
    how_to_fix: str = ""
    suggested_project_task: str | None = None
    interview_risk: str = ""


class MissingSkillAnalysisOutput(AIOutputBase):
    summary: str = ""
    missing_skills: list[MissingSkill] = Field(default_factory=list)
    top_3_priority_gaps: list[str] = Field(default_factory=list)


def sort_by_importance(skills: list[MissingSkill]) -> list[MissingSkill]:
    """Stable sort by importance band (critical first) for display/top-3."""
    return sorted(skills, key=lambda s: IMPORTANCE_ORDER.get(s.importance, 1))
