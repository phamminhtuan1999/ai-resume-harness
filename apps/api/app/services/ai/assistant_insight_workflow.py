"""Job assistant insight workflow (US-030) on the US-027 foundation.

Feature 8: one decision-oriented recommendation per match. Depends on a saved
US-028 match analysis (raises ``missing_match_analysis`` if absent). The model
writes the prose; ``postprocess`` derives the recommendation, risk level, and the
routed next best action server-side so the card can never contradict the score.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.assistant_insight import (
    INSIGHT_LABEL,
    NEXT_ACTION_BY_RECOMMENDATION,
    AssistantInsightOutput,
    match_to_insight_recommendation,
    score_to_risk_level,
)
from app.services.ai.assistant_insight_deterministic import build_assistant_insight
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingMatchAnalysisError,
    UnauthorizedError,
)
from app.services.ai.prompting import with_preamble


@dataclass
class InsightInput:
    match_id: str
    job_title: str
    match_analysis: dict[str, Any]
    overall_score: int
    apply_recommendation: str | None
    missing_skills: dict[str, Any] | None


class AssistantInsightWorkflow(BaseAIWorkflow):
    workflow_type = "assistant_insight"
    subject_type = "match"

    @property
    def output_model(self) -> type[AssistantInsightOutput]:
        return AssistantInsightOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> InsightInput:
        analysis = self.data.get_saved_match_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        # Optional richer context; the insight still works without it.
        missing = self.data.get_missing_skill_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        job = context.get("job") or {}
        return InsightInput(
            match_id=str(context["match"]["id"]),
            job_title=job.get("title") or "this role",
            match_analysis=analysis,
            overall_score=int(analysis.get("overall_score") or 0),
            apply_recommendation=analysis.get("apply_recommendation"),
            missing_skills=missing,
        )

    def build_prompt(self, data: InsightInput) -> str:
        gaps = self._gaps_line(data.match_analysis)
        missing_hint = self._missing_hint(data.missing_skills)
        task = f"""\
Task: Give a single, decision-oriented recommendation for this job.

Provide:
- assistant_summary: 1-2 sentences telling the candidate what to do and why.
- recommendation: apply_now | tailor_resume_first | build_project_first | low_priority.
- why_this_recommendation: grounded in the match analysis below.
- next_best_action: the single most valuable next step.
- application_strategy: how to position the application honestly.
- risk_level: low | medium | high.
- confidence_score: 0..1.

Do not invent experience. Base everything on the analysis below.

Match analysis:
- Overall match: {data.overall_score}% (apply recommendation: {data.apply_recommendation}).
- Top gaps: {gaps}
- Summary: {data.match_analysis.get('assistant_summary') or 'n/a'}
{missing_hint}
"""
        return with_preamble(task)

    def postprocess(
        self, output: AssistantInsightOutput, data: InsightInput
    ) -> AssistantInsightOutput:
        # The saved analysis is authoritative: derive the recommendation, risk,
        # and routed next action so the insight can never contradict the score.
        output.recommendation = match_to_insight_recommendation(
            data.apply_recommendation, data.overall_score
        )
        output.risk_level = score_to_risk_level(data.overall_score)
        output.next_best_action = NEXT_ACTION_BY_RECOMMENDATION[output.recommendation]
        return output

    def deterministic_fallback(self, data: InsightInput) -> dict:
        return build_assistant_insight(
            match_analysis=data.match_analysis, job_title=data.job_title
        )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: AssistantInsightOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: InsightInput,
    ) -> None:
        self.data.save_assistant_insight(
            match_id=subject_id,
            user_profile_id=user_profile_id,
            insight={
                "assistant_summary": output.assistant_summary,
                "recommendation": output.recommendation,
                "why_this_recommendation": output.why_this_recommendation,
                "next_best_action": output.next_best_action,
                "application_strategy": output.application_strategy,
                "risk_level": output.risk_level,
                "confidence_score": output.confidence_score,
                "provider": provider_name,
            },
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: AssistantInsightOutput | None,
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
                title=f"Assistant insight for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        label = INSIGHT_LABEL[output.recommendation]
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise recommends: {label.lower()} for {job_title}.",
            importance="high" if output.risk_level == "high" else "medium",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
        )

    @staticmethod
    def _gaps_line(match_analysis: dict[str, Any]) -> str:
        gaps = match_analysis.get("top_gaps_json") or []
        names = [
            gap.get("gap")
            for gap in gaps
            if isinstance(gap, dict) and gap.get("gap")
        ]
        return ", ".join(names[:5]) or "none recorded"

    @staticmethod
    def _missing_hint(missing: dict[str, Any] | None) -> str:
        if not missing:
            return ""
        priorities = missing.get("top_3_priority_gaps_json") or []
        if not priorities:
            return ""
        return f"- Priority gaps from skill analysis: {', '.join(map(str, priorities))}"
