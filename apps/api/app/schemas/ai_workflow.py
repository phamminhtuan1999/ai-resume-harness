"""Shared schemas for the Period 8 AI workflow foundation (US-027).

Every per-feature AI output model extends ``AIOutputBase`` so the standard flow
can read a confidence score uniformly. The envelope models describe the response
shape reused by every Period 8 endpoint (US-028..US-038).
"""

from typing import Literal

from pydantic import BaseModel, Field

WorkflowType = Literal[
    "match_analysis",
    "missing_skills",
    "resume_suggestions",
    # "resume_draft" generation was retired (US-059 / decision 0019); the value
    # stays so historic ai_workflow_runs rows still validate in run listings.
    "resume_draft",
    "cover_letter",
    "roadmap",
    "interview_prep",
    "assistant_insight",
    "dashboard_summary",
    "activity_description",
    "draft_cv",
]
WorkflowStatus = Literal["queued", "running", "completed", "needs_review", "failed"]
SubjectType = Literal["match", "resume", "job", "dashboard"]
ModelProvider = Literal["gemini", "deterministic"]
Importance = Literal["low", "medium", "high"]


class AIOutputBase(BaseModel):
    """Base for every per-feature AI output model.

    Carries the confidence the model (or deterministic fallback) reports. Model
    and provider metadata are recorded on the ``ai_workflow_runs`` row, not here,
    so the per-feature payload stays focused on domain content.
    """

    confidence_score: float = Field(default=0.0, ge=0, le=1)


class WorkflowRunEnvelope(BaseModel):
    """The ``workflow_run`` half of the standard response envelope."""

    id: str
    workflow_type: WorkflowType
    status: WorkflowStatus
    model_provider: ModelProvider | None = None
    model_name: str | None = None
    latency_ms: int | None = None
    confidence_score: float | None = None
    error_message: str | None = None


class WorkflowResponse(BaseModel):
    """Standard success envelope returned by every Period 8 AI endpoint."""

    workflow_run: WorkflowRunEnvelope
    result: dict


class WorkflowRunSummary(BaseModel):
    """One row of ``GET /api/matches/{matchId}/ai-workflow`` (latest per type).

    ``output_snapshot_json`` and ``error_message`` were added for the US-038
    panel so it can derive step summaries and show failure reasons without a
    second call. ``error_code = blocked_by_dependency`` marks a skipped step.
    """

    workflow_type: WorkflowType
    status: WorkflowStatus
    model_provider: ModelProvider | None = None
    model_name: str | None = None
    confidence_score: float | None = None
    completed_at: str | None = None
    output_snapshot_json: dict | None = None
    error_code: str | None = None
    error_message: str | None = None


class MatchWorkflowRunsResponse(BaseModel):
    match_id: str
    runs: list[WorkflowRunSummary] = Field(default_factory=list)
