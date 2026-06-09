"""Run-full orchestration for the AI Workflow Panel (US-038).

Sequentially drives the match-scoped AI workflows (steps 4-10 of the panel
manifest; pre-match steps 1-3 are derived rows owned by the import flows) in
dependency order. A failed step marks every transitive dependent ``blocked`` —
written as a failed run row with ``error_code = blocked_by_dependency`` so no
schema change is needed. When every step lands ``completed``/``needs_review``,
the match's tracker row (if saved) is flipped to ``prepared``.

No new AI model: each step is its own US-028..US-035 ``BaseAIWorkflow``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.ai.assistant_insight_workflow import AssistantInsightWorkflow
from app.services.ai.base_workflow import BaseAIWorkflow
from app.services.ai.cover_letter_workflow import CoverLetterWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    AIWorkflowError,
    UnauthorizedError,
)
from app.services.ai.interview_prep_workflow import InterviewPrepWorkflow
from app.services.ai.match_analysis_workflow import MatchAnalysisWorkflow
from app.services.ai.missing_skills_workflow import MissingSkillsWorkflow
from app.services.ai.resume_suggestions_workflow import ResumeSuggestionsWorkflow
from app.services.ai.roadmap_workflow import RoadmapWorkflow

BLOCKED_ERROR_CODE = "blocked_by_dependency"
BLOCKED_MESSAGE = "Blocked — a previous step failed."

_SUCCESS_STATUSES = ("completed", "needs_review")

# (workflow_type, workflow class, dependencies). Order is execution order.
# The roadmap consumes the missing-skill analysis (US-034 guard), so it depends
# on missing_skills even though the brief's graph draws it from step 4 only.
STEP_MANIFEST: tuple[tuple[str, type[BaseAIWorkflow], tuple[str, ...]], ...] = (
    ("match_analysis", MatchAnalysisWorkflow, ()),
    ("missing_skills", MissingSkillsWorkflow, ("match_analysis",)),
    ("resume_suggestions", ResumeSuggestionsWorkflow, ("match_analysis", "missing_skills")),
    ("cover_letter", CoverLetterWorkflow, ("match_analysis",)),
    ("roadmap", RoadmapWorkflow, ("match_analysis", "missing_skills")),
    ("interview_prep", InterviewPrepWorkflow, ("match_analysis",)),
    ("assistant_insight", AssistantInsightWorkflow, ("match_analysis",)),
)

STEP_WORKFLOWS: dict[str, type[BaseAIWorkflow]] = {
    workflow_type: cls for workflow_type, cls, _deps in STEP_MANIFEST
}


class RunFullOrchestrator:
    def __init__(
        self,
        *,
        data_client: Any,
        settings: Any,
        manifest: tuple[tuple[str, type[BaseAIWorkflow], tuple[str, ...]], ...] = STEP_MANIFEST,
        gemini_client: Any | None = None,
    ) -> None:
        self.data = data_client
        self.settings = settings
        self.manifest = manifest
        self._gemini_client = gemini_client

    def run(
        self,
        *,
        match_id: str,
        user_profile_id: str,
        force: bool = False,
        request_id: str | None = None,
    ) -> dict:
        # Ownership is asserted once up front; an unauthorized call writes nothing.
        bundle = self.data.get_match_with_resume_and_job(
            match_id=match_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])

        latest = {
            run.get("workflow_type"): run
            for run in self.data.get_latest_runs_for_match(
                match_id=match_id, user_profile_id=user_profile_id
            )
        }

        outcomes: dict[str, str] = {}
        failed_step: str | None = None
        first_error: AIWorkflowError | None = None

        for workflow_type, workflow_cls, depends_on in self.manifest:
            if any(outcomes.get(dep) in ("failed", "blocked") for dep in depends_on):
                self._write_blocked(
                    workflow_type=workflow_type,
                    match_id=match_id,
                    user_profile_id=user_profile_id,
                )
                outcomes[workflow_type] = "blocked"
                continue

            existing = latest.get(workflow_type)
            if not force and existing and existing.get("status") in _SUCCESS_STATUSES:
                outcomes[workflow_type] = "completed"
                continue

            workflow = workflow_cls(
                data_client=self.data,
                settings=self.settings,
                gemini_client=self._gemini_client,
            )
            try:
                workflow.run(
                    subject_id=match_id,
                    user_profile_id=user_profile_id,
                    regenerate=force,
                    request_id=request_id,
                )
                outcomes[workflow_type] = "completed"
            except AIWorkflowError as exc:
                outcomes[workflow_type] = "failed"
                if failed_step is None:
                    failed_step = workflow_type
                    first_error = exc

        steps_completed = sum(1 for status in outcomes.values() if status == "completed")
        steps_failed = sum(1 for status in outcomes.values() if status == "failed")
        steps_blocked = sum(1 for status in outcomes.values() if status == "blocked")

        application_status: str | None = None
        if steps_failed == 0 and steps_blocked == 0:
            if self.data.flip_application_status_prepared(
                match_id=match_id, user_profile_id=user_profile_id
            ):
                application_status = "prepared"

        result: dict[str, Any] = {
            "status": "complete" if steps_failed == 0 and steps_blocked == 0 else "partial",
            "match_id": match_id,
            "application_status": application_status,
            "steps_completed": steps_completed,
            "steps_failed": steps_failed,
            "steps_blocked": steps_blocked,
        }
        if failed_step and first_error:
            result["failed_step"] = failed_step
            result["error"] = first_error.to_envelope()["error"]
        return result

    def _write_blocked(
        self, *, workflow_type: str, match_id: str, user_profile_id: str
    ) -> None:
        run = self.data.insert_workflow_run(
            user_profile_id=user_profile_id,
            workflow_type=workflow_type,
            subject_type="match",
            subject_id=match_id,
        )
        self.data.update_workflow_run(
            run_id=str(run["id"]),
            status="failed",
            completed_at=datetime.now(UTC).isoformat(),
            error_code=BLOCKED_ERROR_CODE,
            error_message=BLOCKED_MESSAGE,
        )
