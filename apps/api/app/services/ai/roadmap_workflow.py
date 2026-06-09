"""Roadmap workflow (US-034) on the US-027 foundation.

Feature 6: turns the US-029 missing-skill analysis into a structured 4-week
improvement roadmap with a coherent project theme, weekly deliverables,
future-use resume bullets, and interview talking points. Both dependency guards
(match analysis, missing-skill analysis) run pre-flight in ``authorize`` so a
422 leaves no run/roadmap/activity row, per the US-034 contract.

Domain rules enforced here (not in the base flow):
- exactly 4 weeks — schema-level (``RoadmapOutput`` validator);
- critical gaps must be covered in week 1 or 2 — violation caps confidence to
  0.5 so the run lands ``needs_review``;
- every week needs a non-empty ``deliverables`` list — same cap;
- ``confidence_score >= 0.7`` -> ``completed`` (raised bar vs the foundation).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.roadmap import RoadmapOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingMatchAnalysisError,
    MissingSkillAnalysisRequiredError,
    UnauthorizedError,
)
from app.services.ai.prompting import with_preamble
from app.services.ai.roadmap_deterministic import build_roadmap

# A critical-gap-placement or empty-deliverables violation caps confidence here,
# below the 0.7 completion bar, so the run is flagged needs_review.
_VIOLATION_CONFIDENCE_CAP = 0.5


@dataclass
class RoadmapInput:
    match_id: str
    job_id: str | None
    job_title: str
    company: str
    target_role: str
    profile_summary: str
    match_analysis: dict[str, Any]
    missing_skills: list[dict[str, Any]]


class RoadmapWorkflow(BaseAIWorkflow):
    workflow_type = "roadmap"
    subject_type = "match"
    low_confidence_threshold = 0.7

    @property
    def output_model(self) -> type[RoadmapOutput]:
        return RoadmapOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id

        # Both dependency guards run pre-flight (before the run row is written):
        # a 422 here must leave no run/roadmap/activity row (US-034 contract).
        analysis = self.data.get_saved_match_analysis(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        skills_row = self.data.get_missing_skill_analysis(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not skills_row:
            raise MissingSkillAnalysisRequiredError(
                DEFAULT_MESSAGES["missing_skill_analysis_required"]
            )

        bundle["match_analysis"] = analysis
        bundle["missing_skills_row"] = skills_row
        return bundle

    def load_input(self, context: dict[str, Any]) -> RoadmapInput:
        profile = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        )
        job = context.get("job") or {}
        skills_row = context.get("missing_skills_row") or {}
        missing_skills = [
            s
            for s in (skills_row.get("missing_skills_json") or [])
            if isinstance(s, dict) and s.get("skill")
        ]
        return RoadmapInput(
            match_id=str(context["match"]["id"]),
            job_id=str(job["id"]) if job.get("id") else None,
            job_title=job.get("title") or "this role",
            company=job.get("company") or "the target company",
            target_role=(profile or {}).get("target_role") or "AI Engineer",
            profile_summary=self._profile_summary(profile),
            match_analysis=context.get("match_analysis") or {},
            missing_skills=missing_skills,
        )

    def build_prompt(self, data: RoadmapInput) -> str:
        task = f"""\
Task: Generate a 4-week improvement roadmap for the candidate based on the
provided match analysis, missing skill analysis, candidate profile, and target
role.

Roadmap rules (enforce strictly):
- Generate EXACTLY 4 weeks. No more, no fewer. week values must be 1, 2, 3, 4.
- Critical gaps (importance = "critical") must be covered in Week 1 or Week 2.
- Every week must produce a visible, concrete deliverable (non-empty
  deliverables list).
- resume_bullet_after_completion must be phrased as future-use after
  completion — NOT as current experience. The UI labels it "Use after
  completion."
- Do not make unrealistic claims such as "master ML in 4 weeks."
- Favor practical AI engineering skills: LLM API integration, structured
  output, RAG, pgvector, evaluation pipelines, and deployment.
- recommended_project_theme should be a single coherent project the candidate
  can build across all 4 weeks, extending it each week.
- success_criteria should describe observable outcomes the candidate can
  verify at the end of week 4.
- confidence_score (0.0-1.0) reflects how well the roadmap matches the
  candidate's actual gaps and the job requirements.

Target role: {data.target_role}
Job: {data.job_title} at {data.company}

Candidate profile:
{data.profile_summary}

Match analysis:
{self._analysis_hint(data.match_analysis)}

Missing skill analysis (close these gaps; critical ones first):
{self._gaps_hint(data.missing_skills)}
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: RoadmapInput) -> dict:
        return build_roadmap(
            missing_skills=data.missing_skills,
            target_role=data.target_role,
            company=data.company,
        )

    def postprocess(self, output: RoadmapOutput, data: RoadmapInput) -> RoadmapOutput:
        if not self._criticals_covered_early(output, data.missing_skills) or any(
            not week.deliverables for week in output.weeks
        ):
            output.confidence_score = min(
                output.confidence_score, _VIOLATION_CONFIDENCE_CAP
            )
        return output

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: RoadmapOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: RoadmapInput,
    ) -> None:
        self.data.upsert_roadmap(
            match_id=subject_id,
            user_profile_id=user_profile_id,
            title=f"4-week {data.target_role} improvement roadmap for {data.company}",
            roadmap_json=output.model_dump(mode="json"),
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: RoadmapOutput | None,
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
                title=f"The 4-week roadmap for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        focus = ", ".join(
            skill for week in output.weeks[:2] for skill in week.skills_covered[:2]
        )
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=(
                f"ApplyWise built a 4-week improvement roadmap for {job_title}"
                + (f" — first focus: {focus}." if focus else ".")
            ),
            importance="medium",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
            assistant_description=output.roadmap_summary or None,
        )

    # --- helpers -------------------------------------------------------------

    @staticmethod
    def _criticals_covered_early(
        output: RoadmapOutput, missing_skills: list[dict[str, Any]]
    ) -> bool:
        criticals = {
            str(s["skill"]).strip().lower()
            for s in missing_skills
            if s.get("importance") == "critical" and s.get("skill")
        }
        if not criticals:
            return True
        early = {
            skill.strip().lower()
            for week in output.weeks
            if week.week in (1, 2)
            for skill in week.skills_covered
        }
        return any(
            critical in covered or covered in critical
            for critical in criticals
            for covered in early
            if covered
        )

    @staticmethod
    def _profile_summary(profile: dict[str, Any] | None) -> str:
        if not profile:
            return "No structured profile provided; rely on the match analysis."
        parts = [
            f"Current role: {profile.get('current_role')}" if profile.get("current_role") else "",
            f"Years of experience: {profile.get('years_of_experience')}"
            if profile.get("years_of_experience") is not None
            else "",
            f"Target role: {profile.get('target_role')}" if profile.get("target_role") else "",
            f"Background: {profile.get('technical_background')}"
            if profile.get("technical_background")
            else "",
        ]
        return "\n".join(p for p in parts if p) or "No structured profile provided."

    @staticmethod
    def _analysis_hint(match_analysis: dict[str, Any]) -> str:
        strengths = [
            s.get("strength")
            for s in match_analysis.get("top_strengths_json") or []
            if isinstance(s, dict) and s.get("strength")
        ]
        return (
            f"- Overall match: {match_analysis.get('overall_score')}%\n"
            f"- Recommendation: {match_analysis.get('apply_recommendation')}\n"
            f"- Proven strengths (build on, do not re-teach): "
            f"{', '.join(strengths[:5]) or 'none recorded'}"
        )

    @staticmethod
    def _gaps_hint(missing_skills: list[dict[str, Any]]) -> str:
        lines = [
            f"- {s.get('skill')} (importance: {s.get('importance', 'medium')}, "
            f"type: {s.get('gap_type', 'true_gap')}; fix: "
            f"{s.get('how_to_fix') or 'build evidence'})"
            for s in missing_skills
        ]
        return "\n".join(lines) or "- (none recorded; derive from the match analysis)"
