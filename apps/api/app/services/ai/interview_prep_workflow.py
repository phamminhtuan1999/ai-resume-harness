"""Interview prep workflow (US-035) on the US-027 foundation.

Feature 7: a personalized interview package per match — job-specific technical /
AI-LLM / system-design / behavioral questions, ranked weak topics from the
US-029 analysis, and per-question answer guidance grounded in resume evidence.
Depends on a saved US-028 match analysis; missing-skill analysis and resume
suggestions are optional enrichments read from their saved rows/snapshots.
``confidence_score < 0.6`` flags the run ``needs_review`` (raised bar vs the
foundation default).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.interview_prep import InterviewPrepOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingJobRequirementsError,
    MissingMatchAnalysisError,
    MissingProfileError,
    UnauthorizedError,
)
from app.services.ai.interview_prep_deterministic import build_interview_prep
from app.services.ai.prompting import with_preamble

_MAX_RESUME_CHARS = 16_000
_MAX_JD_CHARS = 16_000


@dataclass
class InterviewPrepInput:
    match_id: str
    job_id: str | None
    job_title: str
    company: str
    target_role: str
    profile_summary: str
    resume_text: str
    job_description: str
    match_analysis: dict[str, Any]
    missing_skills: list[dict[str, Any]]
    resume_suggestions_hint: str


class InterviewPrepWorkflow(BaseAIWorkflow):
    workflow_type = "interview_prep"
    subject_type = "match"
    low_confidence_threshold = 0.6

    @property
    def output_model(self) -> type[InterviewPrepOutput]:
        return InterviewPrepOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> InterviewPrepInput:
        match_id = str(context["match"]["id"])
        user_profile_id = context["user_profile_id"]

        analysis = self.data.get_saved_match_analysis(
            match_id=match_id, user_profile_id=user_profile_id
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        profile = self.data.get_candidate_profile(user_profile_id=user_profile_id)
        resume = context.get("resume") or {}
        job = context.get("job") or {}

        resume_text = (resume.get("raw_text") or "").strip()
        job_description = (job.get("raw_description") or "").strip()
        if not job_description:
            raise MissingJobRequirementsError(DEFAULT_MESSAGES["missing_job_requirements"])
        if not self._has_profile(profile) and not resume_text:
            raise MissingProfileError(DEFAULT_MESSAGES["missing_profile"])

        skills_row = self.data.get_missing_skill_analysis(
            match_id=match_id, user_profile_id=user_profile_id
        )
        missing_skills = [
            s
            for s in ((skills_row or {}).get("missing_skills_json") or [])
            if isinstance(s, dict) and s.get("skill")
        ]

        suggestions_run = self.data.get_latest_workflow_run(
            match_id=match_id,
            user_profile_id=user_profile_id,
            workflow_type="resume_suggestions",
        )
        return InterviewPrepInput(
            match_id=match_id,
            job_id=str(job["id"]) if job.get("id") else None,
            job_title=job.get("title") or "this role",
            company=job.get("company") or "the company",
            target_role=(profile or {}).get("target_role") or "AI Engineer",
            profile_summary=self._profile_summary(profile),
            resume_text=resume_text[:_MAX_RESUME_CHARS],
            job_description=job_description[:_MAX_JD_CHARS],
            match_analysis=analysis,
            missing_skills=missing_skills,
            resume_suggestions_hint=self._suggestions_hint(suggestions_run),
        )

    def build_prompt(self, data: InterviewPrepInput) -> str:
        task = f"""\
Task: Generate a complete interview preparation package for the candidate
applying to this specific job.

Produce:
- prep_summary: 2-4 sentence overview of what this interview will focus on and
  the candidate's key strengths and risks.
- technical_questions: 4-6 questions the interviewer is likely to ask about the
  technical stack and implementation experience.
- ai_llm_questions: 4-6 questions specific to AI, LLM usage, RAG, evaluation,
  and ML engineering for the role.
- system_design_questions: 2-4 questions about designing production AI systems.
- behavioral_questions: 3-5 questions about how the candidate works, learns,
  and handles gaps.
- weak_topics_to_study: topics from the missing skill analysis the candidate
  must study or build proof for before claiming experience.
- answer_guidance: for each high-priority question, the recommended angle, the
  resume evidence the candidate should cite (or null if none), and a warning
  string if the candidate does not have supporting evidence (tell them to study
  or build proof — do not pretend experience).
- confidence_score: 0.0-1.0 reflecting how complete and specific the output is.

IMPORTANT: When the candidate lacks evidence for a likely question, set
resume_evidence_to_use to null and set warning to a specific study/build-proof
instruction. Never imply the candidate has experience they do not have.

Target role: {data.target_role}

Candidate profile:
{data.profile_summary}

Match analysis:
{self._analysis_hint(data.match_analysis)}

Missing skill analysis (these drive weak_topics_to_study):
{self._gaps_hint(data.missing_skills)}

Resume suggestion strategy (claims to avoid apply here too):
{data.resume_suggestions_hint}

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

    def deterministic_fallback(self, data: InterviewPrepInput) -> dict:
        return build_interview_prep(
            match_analysis=data.match_analysis,
            missing_skills=data.missing_skills,
            job_title=data.job_title,
            company=data.company,
            target_role=data.target_role,
        )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: InterviewPrepOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: InterviewPrepInput,
    ) -> None:
        self.data.upsert_interview_prep(
            match_id=subject_id,
            user_profile_id=user_profile_id,
            prep={
                "questions_json": {
                    "technical_questions": output.technical_questions,
                    "ai_llm_questions": output.ai_llm_questions,
                    "system_design_questions": output.system_design_questions,
                    "behavioral_questions": output.behavioral_questions,
                },
                "weak_topics_json": output.weak_topics_to_study,
                "study_plan_json": {
                    "prep_summary": output.prep_summary,
                    "study_plan": [],
                },
                "answer_guidance_json": [
                    item.model_dump() for item in output.answer_guidance
                ],
            },
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: InterviewPrepOutput | None,
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
                title=f"Interview prep for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        topics = ", ".join(output.weak_topics_to_study[:3]) or "no weak topics"
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=(
                f"ApplyWise prepared interview questions for {job_title} — "
                f"study first: {topics}."
            ),
            # Feature 10 rule: completed interview prep is a direct hiring signal.
            importance="high",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
            assistant_description=output.prep_summary or None,
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
    def _profile_summary(profile: dict[str, Any] | None) -> str:
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
        return "\n".join(p for p in parts if p) or "No structured profile provided."

    @staticmethod
    def _analysis_hint(match_analysis: dict[str, Any]) -> str:
        strengths = [
            s.get("strength")
            for s in match_analysis.get("top_strengths_json") or []
            if isinstance(s, dict) and s.get("strength")
        ]
        gaps = [
            g.get("gap")
            for g in match_analysis.get("top_gaps_json") or []
            if isinstance(g, dict) and g.get("gap")
        ]
        return (
            f"- Overall match: {match_analysis.get('overall_score')}%\n"
            f"- Recommendation: {match_analysis.get('apply_recommendation')}\n"
            f"- Proven strengths to anchor answers in: "
            f"{', '.join(strengths[:5]) or 'none recorded'}\n"
            f"- Gaps interviewers may probe: {', '.join(gaps[:5]) or 'none recorded'}"
        )

    @staticmethod
    def _gaps_hint(missing_skills: list[dict[str, Any]]) -> str:
        lines = [
            f"- {s.get('skill')} (importance: {s.get('importance', 'medium')}, "
            f"evidence: {s.get('evidence_status', 'no_evidence')})"
            for s in missing_skills
        ]
        return "\n".join(lines) or "- (no missing-skill analysis saved; derive from the job)"

    @staticmethod
    def _suggestions_hint(run: dict[str, Any] | None) -> str:
        snapshot = (run or {}).get("output_snapshot_json") or {}
        do_not_claim = snapshot.get("do_not_claim") or []
        if not do_not_claim:
            return "- (no resume suggestion run saved)"
        return "Do not claim: " + json.dumps(do_not_claim)
