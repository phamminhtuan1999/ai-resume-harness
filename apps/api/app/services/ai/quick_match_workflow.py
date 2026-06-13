"""AI quick match workflow (US-068) on the US-027 foundation.

A fast-tier, zero-commitment match-likelihood preview for one saved job — the
explicit "AI quick match" action on the jobs list. It runs the standard run path
(``ai_workflow_runs``, ``subject_type='job'``) but writes no domain row: the
preview payload lives in ``output_snapshot_json``. The deterministic fallback is
the same local pre-score that powers the listing's fit hint, so the preview
still renders when the model is unavailable. Reuse (US-067) is keyed on the job
and profile rows, so re-requesting an unchanged job serves the saved preview
with no model call.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.quick_match import QuickMatchOutput, quick_match_label
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import DEFAULT_MESSAGES, UnauthorizedError
from app.services.ai.prompting import with_preamble
from app.services.ai.quick_match_deterministic import (
    compute_pre_score,
    deterministic_quick_match,
    job_structured_signals,
)

_MAX_JD_CHARS = 6_000  # fast tier — keep the prompt short


@dataclass
class QuickMatchInput:
    job: dict[str, Any]
    profile: dict[str, Any]
    signals: dict[str, Any]
    pre_score: dict[str, Any]


class QuickMatchWorkflow(BaseAIWorkflow):
    workflow_type = "quick_match"
    subject_type = "job"

    @property
    def output_model(self) -> type[QuickMatchOutput]:
        return QuickMatchOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        job = self.data.get_job(job_id=subject_id, user_profile_id=user_profile_id)
        if not job:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        return {"job": job, "user_profile_id": user_profile_id}

    def reuse_identity(self, context: dict[str, Any], data: Any) -> dict[str, Any]:
        # US-067: the preview is determined by the job and the candidate profile.
        # Both are keyed on row id + updated_at (never raw text), so an unchanged
        # job/profile reuses the saved preview with no model call.
        job = context.get("job") or {}
        profile = data.profile or {}
        return {
            "job": f"{job.get('id')}:{job.get('updated_at')}",
            "profile": f"{profile.get('id')}:{profile.get('updated_at')}",
        }

    def load_input(self, context: dict[str, Any]) -> QuickMatchInput:
        job = context["job"]
        profile = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        ) or {}
        signals = job_structured_signals(job)
        pre_score = compute_pre_score(profile=profile, job=job)
        return QuickMatchInput(job=job, profile=profile, signals=signals, pre_score=pre_score)

    def build_prompt(self, data: QuickMatchInput) -> str:
        profile = data.profile
        signals = data.signals
        pre = data.pre_score
        skills = ", ".join(signals["required_skills"][:12]) or "(none listed)"
        local_hint = (
            f"local pre-score tier '{pre['tier']}'"
            + (f" (score {pre['score']})" if pre.get("score") is not None else "")
        )
        jd = (data.job.get("raw_description") or "").strip()[:_MAX_JD_CHARS]
        task = f"""\
Task: Give a quick, honest first read on how well this candidate fits this job.
This is a preview, NOT a full analysis — be brief and do not overstate.

Return:
- likelihood: strong | promising | weak (how likely this is worth pursuing).
- headline: ONE short, plain sentence on the main reason, in second person.
- confidence_score: 0..1 (how sure you are, given the limited data).

Be honest in the coach register: if the fit is weak, say so plainly. Do not
invent skills or experience the candidate has not shown. Lean on the candidate's
known background versus the job's stated requirements.

Candidate:
- Target role: {profile.get('target_role') or '(unknown)'}
- Current role: {profile.get('current_role') or '(unknown)'}
- Years of experience: {profile.get('years_of_experience') if profile.get('years_of_experience') is not None else '(unknown)'}
- Background: {(profile.get('technical_background') or '(unknown)')[:600]}
- Location preference: {profile.get('location_preference') or '(unknown)'}

Job:
- Title: {signals['title'] or '(unknown)'}
- Required skills: {skills}
- Work type: {signals['work_type'] or '(unknown)'}
- Location: {signals['location'] or '(unknown)'}
- Seniority: {signals['seniority'] or '(unknown)'}
- A deterministic local estimate already rates this as {local_hint}; refine it.

Job description (may be truncated):
---
{jd}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: QuickMatchInput) -> dict:
        return deterministic_quick_match(profile=data.profile, job=data.job)

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: QuickMatchOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: QuickMatchInput,
    ) -> None:
        # No domain table: the preview is read from the run's
        # ``output_snapshot_json`` (recorded by the base flow). Nothing to write.
        return None

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: QuickMatchOutput | None,
        context: dict[str, Any],
    ) -> ActivitySpec:
        job = context.get("job") or {}
        related_job_id = str(job["id"]) if job.get("id") else None
        job_title = job.get("title") or "this role"

        if status == "failed" or output is None:
            return ActivitySpec(
                activity_type=f"{self.workflow_type}.failed",
                title=f"Quick match for {job_title} could not be completed.",
                importance="low",
                related_job_id=related_job_id,
            )
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"Quick match for {job_title}: {quick_match_label(output.likelihood).lower()}.",
            importance="low",
            related_job_id=related_job_id,
        )
