"""Tailored resume draft workflow (US-032) on the US-027 foundation.

Feature 4: generates a job-specific Markdown resume from the canonical resume
text plus the accepted/safe US-031 suggestions. Depends on a saved US-028 match
analysis (raises ``missing_match_analysis`` if absent). Unsupported and rejected
suggestions are excluded by default. Persists a ``resume_versions`` row; the
tailoring narrative (summary, included/excluded, quality notes) lives in the run
snapshot. The deterministic fallback ports ``buildTailoredResumeDraft``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.resume_draft import ResumeDraftOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingMatchAnalysisError,
    MissingProfileError,
    UnauthorizedError,
)
from app.services.ai.prompting import with_preamble
from app.services.ai.resume_draft_deterministic import build_resume_draft

_MAX_RESUME_CHARS = 16_000


@dataclass
class ResumeDraftInput:
    match_id: str
    resume_id: str | None
    job_id: str | None
    resume_title: str
    resume_text: str
    job_title: str
    company: str
    suggestions: list[dict[str, Any]]


class ResumeDraftWorkflow(BaseAIWorkflow):
    workflow_type = "resume_draft"
    subject_type = "match"

    @property
    def output_model(self) -> type[ResumeDraftOutput]:
        return ResumeDraftOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> ResumeDraftInput:
        analysis = self.data.get_saved_match_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        resume = context.get("resume") or {}
        job = context.get("job") or {}
        resume_text = (resume.get("raw_text") or "").strip()
        if not resume_text:
            raise MissingProfileError(DEFAULT_MESSAGES["missing_profile"])

        suggestions = self.data.get_resume_suggestions_for_match(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        match = context.get("match") or {}
        return ResumeDraftInput(
            match_id=str(match["id"]),
            resume_id=str(match["resume_id"]) if match.get("resume_id") else None,
            job_id=str(match["job_id"]) if match.get("job_id") else None,
            resume_title=resume.get("title") or "Resume",
            resume_text=resume_text[:_MAX_RESUME_CHARS],
            job_title=job.get("title") or "this role",
            company=job.get("company") or "the company",
            suggestions=suggestions or [],
        )

    def build_prompt(self, data: ResumeDraftInput) -> str:
        task = f"""\
Task: Produce a clean, US-style Markdown resume tailored to this job.

Rules:
- Use ONLY the candidate's canonical resume text and the supported suggestions
  below. Do not invent experience, employers, dates, metrics, or skills.
- Emphasize job-relevant experience; keep it concise and impact-focused.
- Exclude any unsupported claims. List anything you intentionally left out in
  excluded_suggestions with a reason (unsupported | not_selected | low_confidence).
- Preserve the candidate's identity/contact details from the resume.

Return: resume_markdown (the full resume), tailoring_summary (what you emphasized
and why), included_suggestions, excluded_suggestions, quality_notes, and
confidence_score (0..1).

Supported suggestions to weave in (Truth Guard status in brackets):
{self._suggestions_hint(data.suggestions)}

Job ({data.job_title} at {data.company}).

Canonical resume:
---
{data.resume_text}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: ResumeDraftInput) -> dict:
        return build_resume_draft(
            resume_title=data.resume_title,
            resume_text=data.resume_text,
            job_title=data.job_title,
            company=data.company,
            suggestions=data.suggestions,
        )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: ResumeDraftOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: ResumeDraftInput,
    ) -> None:
        title = f"{data.resume_title} tailored for {data.job_title}"
        self.data.insert_resume_version(
            user_profile_id=user_profile_id,
            resume_id=data.resume_id,
            job_id=data.job_id,
            match_id=subject_id,
            title=title,
            content_markdown=output.resume_markdown,
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: ResumeDraftOutput | None,
        context: dict[str, Any],
    ) -> ActivitySpec:
        job = context.get("job") or {}
        match = context.get("match") or {}
        related_match_id = str(match["id"]) if match.get("id") else None
        related_job_id = str(job["id"]) if job.get("id") else None
        job_title = job.get("title") or "this role"

        if status == "failed" or output is None:
            return ActivitySpec(
                activity_type=f"{self.workflow_type}.failed",
                title=f"Tailored resume draft for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise generated a tailored resume draft for {job_title}.",
            importance="medium",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
            assistant_description=output.tailoring_summary or None,
        )

    @staticmethod
    def _suggestions_hint(suggestions: list[dict[str, Any]]) -> str:
        lines = []
        for row in suggestions:
            if not isinstance(row, dict):
                continue
            text = (row.get("suggested_text") or "").strip()
            if not text:
                continue
            guard = row.get("truth_guard_status") or "Needs confirmation"
            action = row.get("user_action") or "pending"
            if guard == "Do not use yet" or action == "rejected":
                continue
            lines.append(f"- [{guard}] {text}")
        return "\n".join(lines) or "- (no saved suggestions; tailor from the resume directly)"
