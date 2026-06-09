"""Match analysis workflow (US-028) on the US-027 foundation.

The reference workflow that proves the foundation end-to-end and ships the real
Feature 1 behavior: Gemini-generated, evidence-based match analysis with the
deterministic analyzer as the typed fallback. The scoring contract is enforced
server-side — ``overall_score`` is always recomputed from the accepted weighting
and the apply recommendation is derived from the resulting band.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.match_analysis import (
    MatchAnalysisOutput,
    reconcile_overall_score,
    score_to_label,
    score_to_recommendation,
)
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingJobRequirementsError,
    MissingProfileError,
    UnauthorizedError,
)
from app.services.ai.match_deterministic import analyze_resume_job_fit
from app.services.ai.prompting import with_preamble

_MAX_RESUME_CHARS = 16_000
_MAX_JD_CHARS = 16_000


@dataclass
class MatchInput:
    match_id: str
    job_id: str | None
    job_title: str
    company: str
    resume_text: str
    job_description: str
    profile_summary: str
    preferences: str


class MatchAnalysisWorkflow(BaseAIWorkflow):
    workflow_type = "match_analysis"
    subject_type = "match"

    @property
    def output_model(self) -> type[MatchAnalysisOutput]:
        return MatchAnalysisOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> MatchInput:
        profile = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        )
        resume = context.get("resume") or {}
        job = context.get("job") or {}

        resume_text = (resume.get("raw_text") or "").strip()
        job_description = (job.get("raw_description") or "").strip()

        if not job_description:
            raise MissingJobRequirementsError(DEFAULT_MESSAGES["missing_job_requirements"])
        if not self._has_profile(profile) and not resume_text:
            raise MissingProfileError(DEFAULT_MESSAGES["missing_profile"])

        return MatchInput(
            match_id=str(context["match"]["id"]),
            job_id=str(job["id"]) if job.get("id") else None,
            job_title=job.get("title") or "this role",
            company=job.get("company") or "the company",
            resume_text=resume_text[:_MAX_RESUME_CHARS],
            job_description=job_description[:_MAX_JD_CHARS],
            profile_summary=self._profile_summary(profile, resume),
            preferences=self._preferences(profile),
        )

    def build_prompt(self, data: MatchInput) -> str:
        task = f"""\
Task: Evaluate how well this candidate fits the job and return a match analysis.

Score 0-100 for each: skill_score, experience_score, ai_readiness_score,
ats_keyword_score, seniority_score, location_score. Provide a one-line
score_explanations entry for each of skill, experience, ai_readiness,
ats_keyword, seniority.

Then provide:
- apply_recommendation: one of apply_now, apply_with_improvements, improve_first,
  not_recommended.
- assistant_summary: 1-2 sentences a candidate can act on.
- fit_reasoning: why this score, grounded in the resume and job.
- top_strengths: each with strength, resume_evidence (quote/paraphrase from the
  resume — omit the strength entirely if the resume gives no evidence),
  job_requirement, why_it_matters.
- top_gaps: each with gap, gap_type (true_gap = candidate lacks it,
  wording_gap = has it but the resume does not say so, proof_gap = claims it
  without evidence), job_requirement, why_it_matters, suggested_action.
- risks: short strings.
- next_best_action: the single most valuable next step.
- confidence_score: 0..1 confidence in this analysis.

Do not invent skills, experience, or evidence the resume does not support.

Candidate profile:
{data.profile_summary}

Candidate preferences:
{data.preferences}

Resume:
---
{data.resume_text}
---

Job ({data.job_title} at {data.company}):
---
{data.job_description}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: MatchInput) -> dict:
        return analyze_resume_job_fit(
            resume_text=data.resume_text, job_description=data.job_description
        )

    def postprocess(
        self, output: MatchAnalysisOutput, data: MatchInput
    ) -> MatchAnalysisOutput:
        # The accepted weighting is authoritative: recompute overall from the
        # sub-scores and derive the recommendation from the resulting band so the
        # structured verdict can never contradict the score.
        output.overall_score = reconcile_overall_score(output)
        output.apply_recommendation = score_to_recommendation(output.overall_score)
        return output

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: MatchAnalysisOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: MatchInput,
    ) -> None:
        self.data.save_match_analysis(
            match_id=subject_id,
            user_profile_id=user_profile_id,
            analysis=self._to_match_columns(output, provider_name),
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: MatchAnalysisOutput | None,
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
                title=f"Match analysis for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        overall = output.overall_score
        label = score_to_label(overall)
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise scored the {job_title} role at {overall}% — {label}.",
            importance=self._importance(overall),
            related_match_id=related_match_id,
            related_job_id=related_job_id,
        )

    # --- helpers -------------------------------------------------------------

    @staticmethod
    def _importance(overall: int) -> str:
        if overall >= 75 or overall < 40:
            return "high"
        return "medium"

    @staticmethod
    def _has_profile(profile: dict[str, Any] | None) -> bool:
        if not profile:
            return False
        return any(
            profile.get(key)
            for key in (
                "candidate_profile_json",
                "current_role",
                "target_role",
                "technical_background",
            )
        )

    @staticmethod
    def _profile_summary(profile: dict[str, Any] | None, resume: dict[str, Any]) -> str:
        if not profile:
            return "No structured profile provided; rely on the resume."
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
        summary = "\n".join(part for part in parts if part)
        return summary or "No structured profile provided; rely on the resume."

    @staticmethod
    def _preferences(profile: dict[str, Any] | None) -> str:
        if not profile:
            return "Not specified."
        location = profile.get("location_preference")
        target = profile.get("target_role")
        bits = [
            f"Preferred location: {location}" if location else "",
            f"Target role: {target}" if target else "",
        ]
        return "\n".join(b for b in bits if b) or "Not specified."

    def _to_match_columns(
        self, output: MatchAnalysisOutput, provider_name: str
    ) -> dict[str, Any]:
        """Map the AI output onto matches columns, keeping legacy columns in sync
        so existing readers (match detail page, tracker) keep working."""
        strengths = [s.model_dump() for s in output.top_strengths]
        gaps = [g.model_dump() for g in output.top_gaps]
        return {
            # Recomputed scores.
            "overall_score": output.overall_score,
            "skill_score": output.skill_score,
            "experience_score": output.experience_score,
            "ai_readiness_score": output.ai_readiness_score,
            "ats_keyword_score": output.ats_keyword_score,
            "seniority_score": output.seniority_score,
            "location_score": output.location_score,
            "seniority_match_label": output.seniority_match_label,
            # New AI columns (migration 0011).
            "apply_recommendation": output.apply_recommendation,
            "assistant_summary": output.assistant_summary,
            "fit_reasoning": output.fit_reasoning,
            "score_explanations_json": output.score_explanations.model_dump(),
            "top_strengths_json": strengths,
            "top_gaps_json": gaps,
            "next_best_action": output.next_best_action,
            "confidence_score": output.confidence_score,
            "analyzer_provider": provider_name,
            # Legacy mirror columns (migration 0002) for backward compatibility.
            "strengths_json": [
                {"skill": s["strength"], "evidence": s["resume_evidence"]}
                for s in strengths
            ],
            "weaknesses_json": [
                {"skill": g["gap"], "reason": g["why_it_matters"]} for g in gaps
            ],
            "missing_skills_json": [
                {
                    "skill": g["gap"],
                    "severity": "Critical" if i < 3 else "Medium",
                    "gap_type": g["gap_type"],
                    "why_it_matters": g["why_it_matters"],
                    "suggested_action": g["suggested_action"],
                }
                for i, g in enumerate(gaps)
            ],
            "risks_json": [{"risk": r, "mitigation": ""} for r in output.risks],
            "explanation_json": {
                "category": score_to_label(output.overall_score),
                "formula": (
                    "overall = skill*0.30 + experience*0.20 + ai_readiness*0.25 "
                    "+ ats_keyword*0.15 + seniority*0.10"
                ),
                "analyzer": provider_name,
            },
        }
