"""Resume suggestions workflow (US-031) on the US-027 foundation.

Feature 3: turns a scored match + gap analysis into concrete, evidence-backed,
section-specific resume rewrites. Depends on a saved US-028 match analysis (raises
``match_analysis_required`` if absent) and optionally consumes the US-029 missing
skill analysis as extra context. Every suggestion's Truth Guard status is mapped
from the model's snake_case enum to the title-case display value the existing
``resume_suggestions`` table stores, before any row is written. The deterministic
fallback re-projects the saved match analysis into the same schema.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.resume_suggestions import TRUTH_GUARD_DISPLAY, ResumeSuggestionOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MatchAnalysisRequiredError,
    MissingJobRequirementsError,
    MissingProfileError,
    UnauthorizedError,
)
from app.services.ai.prompting import with_preamble
from app.services.ai.resume_suggestions_deterministic import build_resume_suggestions

_MAX_RESUME_CHARS = 16_000
_MAX_JD_CHARS = 16_000


@dataclass
class ResumeSuggestionsInput:
    match_id: str
    job_title: str
    company: str
    resume_text: str
    job_description: str
    profile_summary: str
    match_analysis: dict[str, Any]
    missing_skills: dict[str, Any] | None


class ResumeSuggestionsWorkflow(BaseAIWorkflow):
    workflow_type = "resume_suggestions"
    subject_type = "match"
    # The US-031 contract flags low-confidence output below 0.6 (the foundation
    # default is 0.5); the result is still persisted and shown with a badge.
    low_confidence_threshold = 0.6

    @property
    def output_model(self) -> type[ResumeSuggestionOutput]:
        return ResumeSuggestionOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> ResumeSuggestionsInput:
        analysis = self.data.get_saved_match_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MatchAnalysisRequiredError(DEFAULT_MESSAGES["match_analysis_required"])

        profile = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        )
        resume = context.get("resume") or {}
        job = context.get("job") or {}

        resume_text = (resume.get("raw_text") or "").strip()
        job_description = (job.get("raw_description") or "").strip()
        if not job_description and not (job.get("structured_json")):
            raise MissingJobRequirementsError(DEFAULT_MESSAGES["missing_job_requirements"])
        if not self._has_profile(profile) and not resume_text:
            raise MissingProfileError(DEFAULT_MESSAGES["missing_profile"])

        # Optional richer context; suggestions still work without it.
        missing = self.data.get_missing_skill_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        return ResumeSuggestionsInput(
            match_id=str(context["match"]["id"]),
            job_title=job.get("title") or "this role",
            company=job.get("company") or "the company",
            resume_text=resume_text[:_MAX_RESUME_CHARS],
            job_description=job_description[:_MAX_JD_CHARS],
            profile_summary=self._profile_summary(profile),
            match_analysis=analysis,
            missing_skills=missing,
        )

    def build_prompt(self, data: ResumeSuggestionsInput) -> str:
        task = f"""\
Task: Generate a complete set of tailored resume suggestions for this candidate
and job. Use the match analysis and missing skill analysis as context.

For each suggestion:
- suggested_text MUST be resume-ready content — concise text that could sit on
  the resume as-is (a claim, bullet, or summary line). NEVER write advice or an
  instruction to the candidate in suggested_text; guidance belongs in reason.
  The user edits suggested_text directly and accepted text feeds CV generation.
- Cite only resume evidence that actually exists.
- Assign truth_guard_status:
    safe_to_use          - claim is clearly supported by resume/profile evidence.
    needs_confirmation   - may be true based on nearby evidence, but the profile
                           does not prove it clearly; the user must confirm.
    do_not_use_yet       - would add unsupported or invented experience.
- Do not mark any suggestion safe_to_use unless you can quote supporting
  evidence from the resume text.
- do_not_use_yet suggestions must explain what real evidence the user would need
  before the claim could become safe.
- For keywords_to_include, only mark a keyword "supported" when the resume text
  clearly uses or demonstrates that keyword.
- For do_not_claim, list any skills, tools, or achievements that the job requires
  but the resume does not prove.

Also provide resume_strategy (how to position this resume honestly),
assistant_summary (2-3 sentences), and confidence_score (0..1).

Candidate profile:
{data.profile_summary}

Match analysis (already computed):
{self._analysis_hint(data.match_analysis)}
{self._missing_hint(data.missing_skills)}

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

    def deterministic_fallback(self, data: ResumeSuggestionsInput) -> dict:
        return build_resume_suggestions(
            match_analysis=data.match_analysis, job_title=data.job_title
        )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: ResumeSuggestionOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: ResumeSuggestionsInput,
    ) -> None:
        rows = [self._to_suggestion_row(item) for item in output.suggestions]
        self.data.upsert_resume_suggestions(match_id=subject_id, suggestions=rows)

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: ResumeSuggestionOutput | None,
        context: dict[str, Any],
    ) -> ActivitySpec:
        job = context.get("job") or {}
        match = context.get("match") or {}
        related_match_id = str(match["id"]) if match.get("id") else None
        related_job_id = str(job["id"]) if job.get("id") else None
        job_title = job.get("title") or "this role"
        company = job.get("company") or "the company"

        if status == "failed" or output is None:
            return ActivitySpec(
                activity_type=f"{self.workflow_type}.failed",
                title=f"Resume suggestions for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        count = len(output.suggestions)
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise generated {count} resume suggestion(s) for {job_title} at {company}.",
            importance="medium",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
            assistant_description=output.assistant_summary or None,
        )

    # --- helpers -------------------------------------------------------------

    @staticmethod
    def _to_suggestion_row(item: Any) -> dict[str, Any]:
        """Map a validated ``SuggestionItem`` onto ``resume_suggestions`` columns,
        translating the Truth Guard enum to its stored title-case display value."""
        return {
            "original_text": item.original_text,
            "suggested_text": item.suggested_text,
            "suggestion_type": item.section,
            "related_job_requirement": item.related_job_requirement,
            "evidence": item.evidence,
            "truth_guard_status": TRUTH_GUARD_DISPLAY[item.truth_guard_status],
            "reason": item.reason,
            "user_action": "pending",
            "user_edited": False,
        }

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
    def _profile_summary(profile: dict[str, Any] | None) -> str:
        if not profile:
            return "No structured profile provided; rely on the resume."
        parts = [
            f"Current role: {profile.get('current_role')}" if profile.get("current_role") else "",
            f"Target role: {profile.get('target_role')}" if profile.get("target_role") else "",
            f"Background: {profile.get('technical_background')}"
            if profile.get("technical_background")
            else "",
        ]
        return "\n".join(part for part in parts if part) or "No structured profile provided; rely on the resume."

    @staticmethod
    def _analysis_hint(match_analysis: dict[str, Any]) -> str:
        overall = match_analysis.get("overall_score")
        strengths = [
            s.get("strength")
            for s in match_analysis.get("top_strengths_json") or []
            if isinstance(s, dict) and s.get("strength")
        ]
        gaps = [
            f"{g.get('gap')} ({g.get('gap_type', 'true_gap')})"
            for g in match_analysis.get("top_gaps_json") or []
            if isinstance(g, dict) and g.get("gap")
        ]
        return (
            f"- Overall match: {overall}%\n"
            f"- Proven strengths: {', '.join(strengths[:6]) or 'none recorded'}\n"
            f"- Gaps: {', '.join(gaps[:8]) or 'none recorded'}"
        )

    @staticmethod
    def _missing_hint(missing: dict[str, Any] | None) -> str:
        if not missing:
            return ""
        priorities = missing.get("top_3_priority_gaps_json") or []
        if not priorities:
            return ""
        return f"- Priority gaps from skill analysis: {', '.join(map(str, priorities))}"
