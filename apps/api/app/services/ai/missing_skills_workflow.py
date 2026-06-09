"""Missing skill analysis workflow (US-029) on the US-027 foundation.

Feature 2: the deep-dive companion to the match analysis. Depends on a saved
US-028 match analysis (raises ``missing_match_analysis`` if absent), then has the
model classify each gap by importance / gap type / evidence status with a fix,
project task, and interview risk. The deterministic fallback maps the saved
``top_gaps`` into the same schema.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.missing_skills import MissingSkillAnalysisOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingMatchAnalysisError,
    UnauthorizedError,
)
from app.services.ai.missing_skills_deterministic import build_missing_skill_analysis
from app.services.ai.prompting import with_preamble

_MAX_RESUME_CHARS = 16_000
_MAX_JD_CHARS = 16_000


@dataclass
class MissingSkillsInput:
    match_id: str
    job_title: str
    target_role: str
    match_analysis: dict[str, Any]
    resume_text: str
    job_description: str


class MissingSkillsWorkflow(BaseAIWorkflow):
    workflow_type = "missing_skills"
    subject_type = "match"

    @property
    def output_model(self) -> type[MissingSkillAnalysisOutput]:
        return MissingSkillAnalysisOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> MissingSkillsInput:
        analysis = self.data.get_saved_match_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        profile = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        )
        resume = context.get("resume") or {}
        job = context.get("job") or {}
        return MissingSkillsInput(
            match_id=str(context["match"]["id"]),
            job_title=job.get("title") or "this role",
            target_role=(profile or {}).get("target_role") or "AI Engineer",
            match_analysis=analysis,
            resume_text=(resume.get("raw_text") or "").strip()[:_MAX_RESUME_CHARS],
            job_description=(job.get("raw_description") or "").strip()[:_MAX_JD_CHARS],
        )

    def build_prompt(self, data: MissingSkillsInput) -> str:
        gaps_hint = self._gaps_hint(data.match_analysis)
        task = f"""\
Task: Identify the candidate's missing or weak skills for this job and explain each.

For every missing or weak skill, decide:
- importance: critical | medium | nice_to_have (how much this role needs it).
- gap_type: true_gap (no evidence at all) | wording_gap (likely has it but the
  resume does not say so) | proof_gap (claims it without strong evidence).
- evidence_status: no_evidence | weak_evidence | strong_evidence, based ONLY on the resume.
- resume_evidence: a short quote/paraphrase from the resume, or null if none.
- job_requirement, why_it_matters, how_to_fix (a concrete step).
- suggested_project_task: one small project that would prove it, or null.
- interview_risk: the likely interview concern.

Also provide: summary (2-3 sentences), top_3_priority_gaps (skill names), and
confidence_score (0..1). Do not invent skills or evidence the resume lacks.

Target role: {data.target_role}

Gaps already detected by the match analysis (refine and classify these, add any
the analysis missed):
{gaps_hint}

Resume:
---
{data.resume_text}
---

Job ({data.job_title}):
---
{data.job_description}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: MissingSkillsInput) -> dict:
        return build_missing_skill_analysis(
            match_analysis=data.match_analysis, job_title=data.job_title
        )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: MissingSkillAnalysisOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: MissingSkillsInput,
    ) -> None:
        self.data.save_missing_skill_analysis(
            match_id=subject_id,
            user_profile_id=user_profile_id,
            analysis={
                "summary": output.summary,
                "missing_skills_json": [s.model_dump() for s in output.missing_skills],
                "top_3_priority_gaps_json": output.top_3_priority_gaps,
                "confidence_score": output.confidence_score,
                "provider": provider_name,
            },
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: MissingSkillAnalysisOutput | None,
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
                title=f"Skill gap analysis for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        count = len(output.missing_skills)
        has_critical = any(s.importance == "critical" for s in output.missing_skills)
        top = ", ".join(output.top_3_priority_gaps[:3]) or "none"
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise mapped {count} skill gap(s) for {job_title} — top: {top}.",
            importance="high" if has_critical else "medium",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
        )

    @staticmethod
    def _gaps_hint(match_analysis: dict[str, Any]) -> str:
        gaps = match_analysis.get("top_gaps_json") or []
        lines = [
            f"- {gap.get('gap')} ({gap.get('gap_type', 'true_gap')})"
            for gap in gaps
            if isinstance(gap, dict) and gap.get("gap")
        ]
        return "\n".join(lines) or "- (none recorded; derive from the resume and job)"
