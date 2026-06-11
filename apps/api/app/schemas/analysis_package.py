"""Analysis package response schema (US-047, Period 11).

The single composed read model the whole Period 11 UI consumes. The envelope and
field set are frozen in ``docs/decisions/0015-job-analysis-decision-engine.md``
§5; the decision facts mirror the engine's value objects. The package is a pure
composition of saved module rows plus the latest decision snapshot — it never
triggers generation.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PACKAGE_VERSION = "1"

DecisionLabel = Literal[
    "strong_apply", "apply_with_improvements", "learning_target", "not_recommended"
]
RiskLevel = Literal["low", "medium", "high"]
MaterialState = Literal["recommended", "allowed_with_warning", "not_recommended"]
AnalysisState = Literal["not_analyzed", "partial", "complete", "stale"]
ActionPlacement = Literal["primary", "secondary", "advanced"]
ActionState = Literal["enabled", "locked", "done"]


class ResumeRef(BaseModel):
    """Which resume the verdict is about (matches are per (user, resume, job))."""

    id: str | None = None
    title: str | None = None


class ApplicationRef(BaseModel):
    status: str | None = None
    applied_date: str | None = None


class JobSummary(BaseModel):
    id: str | None = None
    title: str = ""
    company: str = ""
    location: str | None = None
    work_type: str | None = None
    job_url: str | None = None


class ScoreBreakdown(BaseModel):
    """Brief Epic 7 view model — overall plus the sub-score breakdown."""

    overall: int = 0
    skill: int = 0
    experience: int = 0
    ai_readiness: int = 0
    ats_keywords: int = 0
    seniority: int = 0


class ConfidenceModel(BaseModel):
    """Qualitative for the header; numeric ``score`` only the Advanced tab shows."""

    score: float | None = None
    qualitative: str = ""
    reasons: list[str] = Field(default_factory=list)


class PreviousDecision(BaseModel):
    label: DecisionLabel
    decided_at: str | None = None


class DecisionModel(BaseModel):
    label: DecisionLabel
    display_label: str
    match_score: int
    risk_level: RiskLevel
    summary: str = ""
    confidence: ConfidenceModel = Field(default_factory=ConfidenceModel)
    previous: PreviousDecision | None = None


class EvidenceMatched(BaseModel):
    label: str
    detail: str = ""


class SkillGap(BaseModel):
    skill: str
    importance: str = "medium"
    gap_type: str = "true_gap"
    evidence_status: str = "no_evidence"
    why_it_matters: str = ""
    how_to_fix: str = ""
    interview_risk: str = ""


class Evidence(BaseModel):
    matched: list[EvidenceMatched] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class NextActionModel(BaseModel):
    type: str
    label: str
    priority: int
    reason: str = ""
    placement: ActionPlacement
    state: ActionState = "enabled"


class MaterialReadinessModel(BaseModel):
    draft_cv: MaterialState
    cover_letter: MaterialState
    reason: str = ""


class AnalysisStep(BaseModel):
    workflow_type: str
    status: str
    model_provider: str | None = None
    model_name: str | None = None
    completed_at: str | None = None


class AnalysisDetails(BaseModel):
    model_provider: str | None = None
    model_name: str | None = None
    last_run_at: str | None = None
    steps: list[AnalysisStep] = Field(default_factory=list)


class AnalysisPackage(BaseModel):
    version: str = PACKAGE_VERSION
    rules_version: str
    analysis_state: AnalysisState
    stale: bool = False
    analyzed_at: str | None = None
    job: JobSummary = Field(default_factory=JobSummary)
    resume: ResumeRef = Field(default_factory=ResumeRef)
    application: ApplicationRef | None = None
    decision: DecisionModel | None = None
    scores: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    evidence: Evidence = Field(default_factory=Evidence)
    skill_gaps: list[SkillGap] = Field(default_factory=list)
    next_actions: list[NextActionModel] = Field(default_factory=list)
    material_readiness: MaterialReadinessModel | None = None
    analysis_details: AnalysisDetails = Field(default_factory=AnalysisDetails)


class DecisionHistoryInputs(BaseModel):
    """The freshness of the inputs a snapshot used — human summaries only, never
    raw row ids (US-054)."""

    resume_updated_at: str | None = None
    job_updated_at: str | None = None
    profile_updated_at: str | None = None


class DecisionHistoryEntry(BaseModel):
    """One persisted decision snapshot, newest-first in the history list."""

    id: str | None = None
    label: DecisionLabel
    display_label: str
    match_score: float | None = None
    risk_level: RiskLevel | None = None
    confidence: float | None = None
    summary: str = ""
    previous_label: DecisionLabel | None = None
    rules_version: str = ""
    decided_at: str | None = None
    inputs: DecisionHistoryInputs = Field(default_factory=DecisionHistoryInputs)


class AnalysisDecisionHistory(BaseModel):
    """Read-only decision history for a match (US-054). Newest-first, capped; the
    dropped count is surfaced so a truncated list never reads as the whole story."""

    version: str = PACKAGE_VERSION
    match_id: str
    returned: int = 0
    total: int = 0
    dropped: int = 0
    entries: list[DecisionHistoryEntry] = Field(default_factory=list)


__all__ = [
    "PACKAGE_VERSION",
    "AnalysisPackage",
    "AnalysisDecisionHistory",
    "DecisionHistoryEntry",
    "DecisionHistoryInputs",
    "DecisionModel",
    "ScoreBreakdown",
    "ConfidenceModel",
    "PreviousDecision",
    "Evidence",
    "SkillGap",
    "NextActionModel",
    "MaterialReadinessModel",
    "AnalysisDetails",
    "AnalysisStep",
    "JobSummary",
    "ResumeRef",
    "ApplicationRef",
]
