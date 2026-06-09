"""Dashboard AI summary workflow (US-036) on the US-027 foundation.

Feature 9: one user-scoped synthesis across every saved job — patterns, not
per-job commentary. ``subject_type = dashboard`` with a null subject id. The
data gate (fewer than 3 completed match/gap analyses) is checked by the router
BEFORE ``run()`` so no run row or model call happens; ``authorize`` here guards
the candidate profile pre-flight (no run row on ``missing_profile``).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.dashboard import DashboardSummaryOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.dashboard_summary_deterministic import build_dashboard_summary
from app.services.ai.errors import DEFAULT_MESSAGES, MissingProfileError
from app.services.ai.prompting import with_preamble


@dataclass
class DashboardSummaryInput:
    payload: dict[str, Any]


class DashboardSummaryWorkflow(BaseAIWorkflow):
    workflow_type = "dashboard_summary"
    subject_type = "dashboard"

    @property
    def output_model(self) -> type[DashboardSummaryOutput]:
        return DashboardSummaryOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        # The subject is the user's own dashboard, so ownership is implied by the
        # resolved profile; the pre-flight guard here is profile completeness
        # (US-036 contract: missing_profile leaves no run row).
        profile = self.data.get_candidate_profile(user_profile_id=user_profile_id)
        if not self._has_profile(profile):
            raise MissingProfileError(DEFAULT_MESSAGES["missing_profile"])
        return {"user_profile_id": user_profile_id, "profile": profile}

    def load_input(self, context: dict[str, Any]) -> DashboardSummaryInput:
        payload = self.data.get_dashboard_summary_input(
            user_profile_id=context["user_profile_id"]
        )
        payload["candidate_profile"] = self._profile_payload(context.get("profile"))
        return DashboardSummaryInput(payload=payload)

    def build_prompt(self, data: DashboardSummaryInput) -> str:
        task = f"""\
Task: Generate a dashboard summary of the user's overall job search.

You are given:
- candidate_profile: the user's structured profile
- jobs: list of jobs the user has added
- match_scores: per-job overall match percentages
- application_statuses: current application state per job
- missing_skills_across_jobs: skill gaps identified per job (from missing-skills analysis)
- recent_activities: recent AI workflow events for this user

Answer these questions:
1. How is the user doing overall? (dashboard_summary)
2. Which role types match their profile best? (best_fit_roles)
3. Which skills appear repeatedly as gaps across jobs? (repeated_skill_gaps)
4. What is the user's job search health: strong, moderate, or weak? (job_search_health)
5. What are the most important next actions? (recommended_next_actions)

Identify patterns across jobs — do not comment on individual jobs.
Be honest if the data is sparse. confidence_score = 0.0-1.0.

Aggregated data:
{json.dumps(data.payload, default=str)}
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: DashboardSummaryInput) -> dict:
        return build_dashboard_summary(data.payload)

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: DashboardSummaryOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: DashboardSummaryInput,
    ) -> None:
        self.data.upsert_dashboard_summary(
            user_profile_id=user_profile_id,
            summary={
                "dashboard_summary": output.dashboard_summary,
                "best_fit_roles_json": output.best_fit_roles,
                "repeated_skill_gaps_json": output.repeated_skill_gaps,
                "job_search_health": output.job_search_health,
                "recommended_next_actions_json": output.recommended_next_actions,
                "confidence_score": output.confidence_score,
                "provider": provider_name,
            },
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: DashboardSummaryOutput | None,
        context: dict[str, Any],
    ) -> ActivitySpec:
        if status == "failed" or output is None:
            return ActivitySpec(
                activity_type=f"{self.workflow_type}.failed",
                title="The job-search summary could not be completed.",
                importance="low",
            )

        gaps = ", ".join(output.repeated_skill_gaps[:3]) or "no repeating gaps"
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=(
                f"ApplyWise summarized your job search — health: "
                f"{output.job_search_health}; repeated gaps: {gaps}."
            ),
            importance="medium",
            assistant_description=output.dashboard_summary or None,
        )

    # --- helpers -------------------------------------------------------------

    @staticmethod
    def _has_profile(profile: dict[str, Any] | None) -> bool:
        if not profile:
            return False
        return any(
            profile.get(field)
            for field in (
                "current_role",
                "target_role",
                "technical_background",
                "candidate_profile_json",
            )
        )

    @staticmethod
    def _profile_payload(profile: dict[str, Any] | None) -> dict[str, Any]:
        if not profile:
            return {}
        return {
            "current_role": profile.get("current_role"),
            "years_of_experience": profile.get("years_of_experience"),
            "target_role": profile.get("target_role"),
            "location_preference": profile.get("location_preference"),
            "technical_background": profile.get("technical_background"),
        }
