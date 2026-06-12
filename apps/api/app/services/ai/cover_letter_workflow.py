"""Cover letter workflow (US-033, reworked by US-063) on the US-027 foundation.

Feature 5: generates a personalized, honest cover letter per match. Depends on a
saved US-028 match analysis (raises ``missing_match_analysis`` if absent) and —
since US-063 / decision 0019 — on a Tailored CV with renderable content
(raises ``missing_draft_cv`` otherwise; there is no raw-resume fallback). The
letter is written from the **final Tailored CV**: only claims that survived the
truth guard can be referenced, so the letter always matches the document the
candidate actually submits. The deterministic fallback assembles the same from
a template using renderable content only. One cover letter per match (upserted
on regenerate), linked to the source draft CV version for the staleness hint.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.cover_letter import CoverLetterOutput
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.cover_letter_deterministic import build_cover_letter
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingDraftCvError,
    MissingMatchAnalysisError,
    UnauthorizedError,
)
from app.services.ai.prompting import with_preamble
from app.services.export.render_model import build_render_model, is_empty_cv


@dataclass
class CoverLetterInput:
    match_id: str
    job_id: str | None
    job_title: str
    company: str
    profile_summary: str
    match_analysis: dict[str, Any]
    # US-063: the renderable Tailored CV the letter is written from.
    draft_cv_id: str | None = None
    draft_cv_version: int | None = None
    cv_content: str = ""
    cv_bullets: list[str] = field(default_factory=list)


class CoverLetterWorkflow(BaseAIWorkflow):
    workflow_type = "cover_letter"
    subject_type = "match"

    @property
    def output_model(self) -> type[CoverLetterOutput]:
        return CoverLetterOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> CoverLetterInput:
        analysis = self.data.get_saved_match_analysis(
            match_id=str(context["match"]["id"]),
            user_profile_id=context["user_profile_id"],
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        profile = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        )
        match = context.get("match") or {}
        job = context.get("job") or {}

        # US-063: the letter is written from the final Tailored CV. No CV (or
        # no renderable content) is a guided error, never a raw-resume fallback.
        draft = self.data.get_latest_draft_cv(
            match_id=str(match["id"]), user_profile_id=context["user_profile_id"]
        )
        if not draft:
            raise MissingDraftCvError(DEFAULT_MESSAGES["missing_draft_cv"])
        render_model = build_render_model(draft.get("cv_json") or {})
        if is_empty_cv(render_model):
            raise MissingDraftCvError(
                "Your Tailored CV has no approved content yet. Approve at least "
                "one item, then generate the cover letter."
            )

        return CoverLetterInput(
            match_id=str(match["id"]),
            job_id=str(job["id"]) if job.get("id") else None,
            job_title=job.get("title") or "this role",
            company=job.get("company") or "the company",
            profile_summary=self._profile_summary(profile),
            match_analysis=analysis,
            draft_cv_id=str(draft["id"]) if draft.get("id") else None,
            draft_cv_version=draft.get("version"),
            cv_content=_cv_content(render_model),
            cv_bullets=_cv_bullets(render_model),
        )

    def build_prompt(self, data: CoverLetterInput) -> str:
        task = f"""\
Task: Write a concise, honest cover letter for this job.

Requirements:
- Reference the company ({data.company}) and role ({data.job_title}) by name.
- Lead with the candidate's strongest supported angle from the match analysis.
- Reference ONLY claims that appear in the tailored CV content below — it is
  the exact document the candidate will submit, already verified for truth.
  Never reach beyond it for experience, skills, or results.
- Keep it to ~3 short paragraphs with a professional closing. List anything
  you deliberately avoided in claims_avoided.

Return: cover_letter (full text), cover_letter_strategy (the angle you chose and
why), key_points_used, claims_avoided, tone (professional | concise |
enthusiastic), and confidence_score (0..1).

Candidate profile:
{data.profile_summary}

Match analysis:
{self._analysis_hint(data.match_analysis)}

Tailored CV content (the verified source of claims):
---
{data.cv_content}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: CoverLetterInput) -> dict:
        return build_cover_letter(
            match_analysis=data.match_analysis,
            job_title=data.job_title,
            company=data.company,
            cv_bullets=data.cv_bullets,
        )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: CoverLetterOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: CoverLetterInput,
    ) -> None:
        self.data.save_cover_letter(
            match_id=subject_id,
            user_profile_id=user_profile_id,
            cover_letter={
                "job_id": data.job_id,
                "cover_letter": output.cover_letter,
                "cover_letter_strategy": output.cover_letter_strategy,
                "key_points_json": output.key_points_used,
                "claims_avoided_json": output.claims_avoided,
                "tone": output.tone,
                "confidence_score": output.confidence_score,
                "provider": provider_name,
                # US-063 version linkage for the staleness hint.
                "source_draft_cv_id": data.draft_cv_id,
                "source_draft_cv_version": data.draft_cv_version,
            },
        )

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: CoverLetterOutput | None,
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
                title=f"Cover letter for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise drafted a cover letter for {job_title} at {company}.",
            # Feature 10 rule: a generated cover letter is a direct hiring signal.
            importance="high",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
            assistant_description=output.cover_letter_strategy or None,
        )

    # --- helpers -------------------------------------------------------------

    @staticmethod
    def _profile_summary(profile: dict[str, Any] | None) -> str:
        if not profile:
            return "No structured profile provided; rely on the match analysis."
        parts = [
            f"Current role: {profile.get('current_role')}" if profile.get("current_role") else "",
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
            if isinstance(g, dict) and g.get("gap_type") == "true_gap" and g.get("gap")
        ]
        return (
            f"- Overall match: {match_analysis.get('overall_score')}%\n"
            f"- Proven strengths to lead with: {', '.join(strengths[:5]) or 'none recorded'}\n"
            f"- Unproven skills to avoid claiming: {', '.join(gaps[:5]) or 'none recorded'}"
        )


# --- US-063 renderable-CV content helpers ----------------------------------------

_MAX_CV_CONTENT_CHARS = 6_000


def _cv_bullets(render_model: dict[str, Any]) -> list[str]:
    return [
        text
        for section in ("work_experience", "projects")
        for entry in render_model.get(section) or []
        for text in entry.get("bullets") or []
    ]


def _cv_content(render_model: dict[str, Any]) -> str:
    """Compact text view of the renderable CV for the prompt: exactly the
    claims the export contains, nothing more."""
    lines: list[str] = []
    summary = (render_model.get("professional_summary") or "").strip()
    if summary:
        lines.append(f"Summary: {summary}")
    for group in render_model.get("skills") or []:
        items = ", ".join(group.get("items") or [])
        if items:
            lines.append(f"Skills — {group.get('category') or 'General'}: {items}")
    for section, label in (("work_experience", "Experience"), ("projects", "Project")):
        for entry in render_model.get(section) or []:
            heading = entry.get("title") or entry.get("name") or ""
            company = entry.get("company") or ""
            name = " — ".join(part for part in (heading, company) if part)
            for text in entry.get("bullets") or []:
                lines.append(f"{label} ({name}): {text}" if name else f"{label}: {text}")
    return "\n".join(lines)[:_MAX_CV_CONTENT_CHARS]
