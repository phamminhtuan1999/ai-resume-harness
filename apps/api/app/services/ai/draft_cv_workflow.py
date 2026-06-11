"""Draft CV generation workflow (US-039) on the US-027 foundation.

Generates a job-tailored, truth-guarded structured CV for a match in one model
call, following the Cross-Referencing & Enhancement Protocol. Requires a saved
US-028 match analysis (``missing_match_analysis`` otherwise). The model output is
validated, then passed through deterministic server guards (metrics, keyword
support, XYZ lint) that the prompt alone cannot guarantee; contact and target-job
fields are overwritten server-side so they can never be invented. Each generation
is persisted as a new append-only ``draft_cvs`` version with stable bullet ids,
per-bullet ``user_action``, and a derived review/export status. The deterministic
fallback copies the candidate's own content verbatim.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.schemas.ai_workflow import WorkflowStatus
from app.schemas.draft_cv import CandidateContact, DraftCvOutput, QualityNote, TargetJob
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.draft_cv_deterministic import build_draft_cv
from app.services.ai.draft_cv_logic import (
    assign_bullet_ids,
    derive_draft_status,
    lint_forces_review,
    run_guards,
)
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    MissingMatchAnalysisError,
    MissingProfileError,
    UnauthorizedError,
)
from app.services.ai.prompting import with_preamble
from app.services.export.page_policy import PagePolicy, clamp_page_count, compute_page_policy

_MAX_RESUME_CHARS = 16_000
_LOW_CONFIDENCE = 0.49


@dataclass
class DraftCvInput:
    match_id: str
    resume_id: str | None
    job_id: str | None
    job_title: str | None
    company: str | None
    source_url: str | None
    resume_text: str
    candidate_profile: dict[str, Any]
    contact: dict[str, Any]
    job_keywords: list[str]
    accepted_suggestions: list[str]
    corpus: str = ""
    keyword_hint: str = ""
    # US-043: the server-authoritative page policy (computed before the prompt)
    # and the model's pre-clamp recommendation (captured in postprocess for the
    # rendering_json audit trail).
    page_policy: PagePolicy | None = None
    model_recommendation: dict[str, Any] | None = None


class DraftCvWorkflow(BaseAIWorkflow):
    workflow_type = "draft_cv"
    subject_type = "match"

    @property
    def output_model(self) -> type[DraftCvOutput]:
        return DraftCvOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        bundle = self.data.get_match_with_resume_and_job(
            match_id=subject_id, user_profile_id=user_profile_id
        )
        if not bundle:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        bundle["user_profile_id"] = user_profile_id
        return bundle

    def load_input(self, context: dict[str, Any]) -> DraftCvInput:
        match = context.get("match") or {}
        analysis = self.data.get_saved_match_analysis(
            match_id=str(match["id"]), user_profile_id=context["user_profile_id"]
        )
        if not analysis or analysis.get("apply_recommendation") is None:
            raise MissingMatchAnalysisError(DEFAULT_MESSAGES["missing_match_analysis"])

        resume = context.get("resume") or {}
        job = context.get("job") or {}
        resume_text = (resume.get("raw_text") or "").strip()
        if not resume_text:
            raise MissingProfileError(DEFAULT_MESSAGES["missing_profile"])

        profile_row = self.data.get_candidate_profile(
            user_profile_id=context["user_profile_id"]
        )
        candidate_profile = (profile_row or {}).get("candidate_profile_json") or {}
        basic = candidate_profile.get("basic_info") or {}

        suggestions = self.data.get_resume_suggestions_for_match(
            match_id=str(match["id"]), user_profile_id=context["user_profile_id"]
        )
        accepted = [
            (row.get("suggested_text") or "").strip()
            for row in suggestions or []
            if isinstance(row, dict)
            and (
                row.get("user_action") == "accepted"
                or row.get("truth_guard_status") == "Safe to use"
            )
            and (row.get("suggested_text") or "").strip()
        ]

        job_keywords = _job_keywords(job.get("structured_json"))

        data = DraftCvInput(
            match_id=str(match["id"]),
            resume_id=str(match["resume_id"]) if match.get("resume_id") else None,
            job_id=str(match["job_id"]) if match.get("job_id") else None,
            job_title=job.get("title"),
            company=job.get("company"),
            source_url=job.get("job_url"),
            resume_text=resume_text[:_MAX_RESUME_CHARS],
            candidate_profile=candidate_profile,
            contact={
                "full_name": basic.get("full_name") or "",
                # Contact fields the user edits on the career profile win over
                # the values extracted from the resume text at import time.
                "email": (profile_row or {}).get("contact_email")
                or basic.get("email"),
                "phone": (profile_row or {}).get("phone") or basic.get("phone"),
                "location": (profile_row or {}).get("location_preference")
                or basic.get("location"),
                "linkedin_url": basic.get("linkedin_url"),
                "github_url": basic.get("github_url"),
                "portfolio_url": basic.get("portfolio_url"),
            },
            job_keywords=job_keywords,
            accepted_suggestions=accepted,
        )
        data.corpus = _build_corpus(resume_text, candidate_profile, accepted)
        data.keyword_hint = ", ".join(job_keywords[:40]) or "(none parsed)"
        data.page_policy = compute_page_policy(
            years_of_experience=(profile_row or {}).get("years_of_experience"),
            candidate_profile=candidate_profile,
            current_role=(profile_row or {}).get("current_role"),
            job_title=job.get("title"),
            job_structured=job.get("structured_json"),
        )
        return data

    def build_prompt(self, data: DraftCvInput) -> str:
        task = f"""\
Task: Generate a job-tailored, ATS-safe CV for this software engineer as
structured JSON. Follow the Cross-Referencing & Enhancement Protocol exactly.

Protocol:
1. Keyword extraction: the job's key skills/tools are: {data.keyword_hint}.
2. Alignment & injection: feature a job keyword in a bullet ONLY when the
   candidate's resume/profile already supports it. Never claim an unsupported
   skill. Group skills logically by category.
3. XYZ rule: rewrite EVERY experience and project bullet as
   "strong action verb + what was done / tech used + impact or result". Start
   each bullet with a strong past-tense action verb. Keep each bullet to at most
   two printed lines (<= 240 characters).
4. Metrics: preserve real numbers, percentages, and dollar figures EXACTLY as
   the resume states them. Never invent, estimate, or inflate a number. When no
   metric exists, use qualitative impact (scope, reliability, collaboration).
5. Truth Guard: classify every bullet as safe_to_use (clearly supported),
   needs_confirmation (plausible but not explicit), or do_not_use_yet (would add
   an unsupported claim). Give each bullet a short source_evidence quote/paraphrase
   from the resume and the keywords_used.

Also return cv_strategy (summary, primary_positioning, keywords_prioritized,
keywords_excluded[{{keyword, reason}}]) and professional_summary. Do not invent
contact details, employers, dates, education, or certifications. Return JSON only.

Rendering recommendation: {_policy_hint(data.page_policy)} Also return
rendering_recommendation with recommended_page_count (within that range),
page_count_reason (1-2 plain sentences for the candidate), font_profile
(modern_latex | ats_clean | classic_latex; modern_latex unless the role is
corporate/ATS-strict -> ats_clean, or research/academic -> classic_latex),
layout_density (compact | standard | spacious), and compression_strategy
(3-5 short strings describing what to prioritize or condense if space runs
short). Word every bullet concisely so the full CV fits the target page count.

Candidate profile (structured, source of truth):
{_profile_hint(data.candidate_profile)}

Accepted/safe resume suggestions to weave in when relevant:
{_suggestions_hint(data.accepted_suggestions)}

Canonical resume text:
---
{data.resume_text}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: DraftCvInput) -> dict:
        return build_draft_cv(
            candidate_profile=data.candidate_profile,
            job_title=data.job_title,
            company=data.company,
            source_url=data.source_url,
            job_keywords=data.job_keywords,
            page_policy=data.page_policy,
        )

    def postprocess(self, output: DraftCvOutput, data: DraftCvInput) -> DraftCvOutput:
        # Contact + target job are authoritative server-side: never trust the
        # model with details it could invent.
        output.candidate = CandidateContact(**data.contact)
        output.target_job = TargetJob(
            company=data.company, title=data.job_title, source_url=data.source_url
        )
        notes = run_guards(output, data.corpus)
        # > 2 weak-verb notes is a quality signal worth a human look; force the
        # run (and therefore the draft) to needs_review via confidence.
        if lint_forces_review(notes):
            output.confidence_score = min(output.confidence_score, _LOW_CONFIDENCE)
        self._apply_page_policy(output, data)
        return output

    def _apply_page_policy(self, output: DraftCvOutput, data: DraftCvInput) -> None:
        """Clamp the model's page count into the server policy (US-043). Runs
        after ``run_guards`` because the guards replace ``quality_notes``."""
        policy = data.page_policy
        if policy is None:
            return
        rec = output.rendering_recommendation
        data.model_recommendation = {
            "recommended_page_count": rec.recommended_page_count,
            "font_profile": rec.font_profile,
            "layout_density": rec.layout_density,
        }
        clamped, moved = clamp_page_count(rec.recommended_page_count, policy)
        if moved:
            output.quality_notes.append(
                QualityNote(
                    code="policy_clamped",
                    detail=(
                        f"The model suggested {rec.recommended_page_count} page(s); "
                        f"with {policy.basis} ApplyWise allows at most "
                        f"{policy.max_pages}, so {clamped} page(s) is recommended."
                    ),
                )
            )
            rec.recommended_page_count = clamped
        for code in policy.notes:
            if code == "yoe_unknown":
                output.quality_notes.append(
                    QualityNote(
                        code="yoe_unknown",
                        detail=(
                            "Your years of experience could not be determined, so a "
                            "1-page resume (2 maximum) is assumed. Set it in your "
                            "profile for a tailored recommendation."
                        ),
                    )
                )

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: DraftCvOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: DraftCvInput,
    ) -> None:
        cv_json = assign_bullet_ids(output)
        draft_status = derive_draft_status(cv_json, output.confidence_score)
        title = _draft_title(data)
        rendering_json = None
        if data.page_policy is not None:
            rendering_json = {
                "recommendation": output.rendering_recommendation.model_dump(mode="json"),
                "page_policy": data.page_policy.as_dict(),
                "model_recommendation": data.model_recommendation,
            }
        self.data.insert_draft_cv(
            user_profile_id=user_profile_id,
            match_id=subject_id,
            job_id=data.job_id,
            resume_id=data.resume_id,
            title=title,
            status=draft_status,
            cv_json=cv_json,
            cv_strategy_json=output.cv_strategy.model_dump(mode="json"),
            quality_notes_json=[n.model_dump(mode="json") for n in output.quality_notes],
            confidence_score=output.confidence_score,
            provider=provider_name,
            model_name=(
                self.settings.gemini_model
                if provider_name == "gemini"
                else "deterministic-baseline"
            ),
            rendering_json=rendering_json,
        )

    def build_activity(
        self, *, status: WorkflowStatus, output: DraftCvOutput | None, context: dict[str, Any]
    ) -> ActivitySpec:
        job = context.get("job") or {}
        match = context.get("match") or {}
        related_match_id = str(match["id"]) if match.get("id") else None
        related_job_id = str(job["id"]) if job.get("id") else None
        job_title = job.get("title") or "this role"

        if status == "failed" or output is None:
            return ActivitySpec(
                activity_type=f"{self.workflow_type}.failed",
                title=f"Draft CV for {job_title} could not be completed.",
                importance="low",
                related_match_id=related_match_id,
                related_job_id=related_job_id,
            )

        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"ApplyWise generated a tailored draft CV for {job_title}.",
            importance="medium",
            related_match_id=related_match_id,
            related_job_id=related_job_id,
            assistant_description=output.cv_strategy.summary or None,
        )


# --- helpers --------------------------------------------------------------------


def _job_keywords(structured_json: Any) -> list[str]:
    if not isinstance(structured_json, dict):
        return []
    keywords: list[str] = []
    for key in ("required_skills", "preferred_skills", "ai_requirements", "cloud_requirements"):
        for value in structured_json.get(key) or []:
            if isinstance(value, str) and value.strip():
                keywords.append(value.strip())
    # de-dupe, preserve order
    return list(dict.fromkeys(keywords))


def _build_corpus(
    resume_text: str, candidate_profile: dict[str, Any], accepted_suggestions: list[str]
) -> str:
    parts = [resume_text, json.dumps(candidate_profile), *accepted_suggestions]
    return "\n".join(parts).lower()


def _profile_hint(candidate_profile: dict[str, Any]) -> str:
    if not candidate_profile:
        return "(no structured profile; rely on the canonical resume text below)"
    # Compact, non-secret view: titles + skill names; the full resume text is the
    # detailed source. Keep it short to control tokens.
    skills = candidate_profile.get("skills") or {}
    skill_names = [s for values in skills.values() if isinstance(values, list) for s in values]
    roles = [
        f"{(w.get('title') or '').strip()} @ {(w.get('company') or '').strip()}"
        for w in candidate_profile.get("work_experience") or []
        if isinstance(w, dict)
    ]
    return (
        f"Skills: {', '.join(skill_names[:40]) or 'none listed'}\n"
        f"Roles: {'; '.join(r for r in roles if r.strip(' @')) or 'none listed'}"
    )


def _suggestions_hint(accepted_suggestions: list[str]) -> str:
    if not accepted_suggestions:
        return "- (none accepted; tailor from the resume directly)"
    return "\n".join(f"- {text}" for text in accepted_suggestions[:20])


def _policy_hint(policy: PagePolicy | None) -> str:
    if policy is None:
        return "Target 1 page (2 maximum)."
    return (
        f"The server page policy for this candidate ({policy.basis}) is: "
        f"target {policy.target_pages} page(s), maximum {policy.max_pages}."
    )


def _draft_title(data: DraftCvInput) -> str:
    company = data.company or "Company"
    title = data.job_title or "Role"
    return f"Draft CV — {company} {title}"
