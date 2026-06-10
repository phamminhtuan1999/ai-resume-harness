"""Draft CV output schema (US-039, Period 9 AI Draft CV Export).

The structured, truth-guarded CV the model (or deterministic fallback) produces
for one match. Bullet ``text`` is capped at 240 chars so a bullet renders within
two printed lines in the ATS template (US-041); an over-long bullet fails schema
validation, triggering the foundation's retry-then-fallback path.

The model returns bullets **without** ``id`` or ``user_action`` — those are
assigned server-side after the guards run (see ``draft_cv_logic``) so the model
can never fabricate a stable identifier or pre-approve its own claims.
``candidate`` and ``target_job`` are overwritten server-side from the real
profile/job so contact and company details are never invented.
``quality_notes`` and ``cv_strategy.keywords_excluded`` are produced/extended by
the server guards; any model-supplied values are replaced.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai_workflow import AIOutputBase

# Reuses the US-031 Truth Guard model enum (snake_case). Stored snake_case in
# draft_cvs.cv_json — unlike resume_suggestions, which stores title-case display
# values. See docs/product/data-model.md.
TruthGuardStatus = Literal["safe_to_use", "needs_confirmation", "do_not_use_yet"]
KeywordExclusionReason = Literal["unsupported", "weak_evidence", "irrelevant"]
BULLET_MAX_CHARS = 240

# Period 10 rendering vocabulary (decision 0014). The page count is clamped by
# the server page policy after validation; the rest is display-only rationale.
FontProfile = Literal["modern_latex", "ats_clean", "classic_latex"]
LayoutDensity = Literal["compact", "standard", "spacious"]


class CandidateContact(BaseModel):
    full_name: str = ""
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None


class TargetJob(BaseModel):
    company: str | None = None
    title: str | None = None
    source_url: str | None = None


class ExcludedKeyword(BaseModel):
    keyword: str
    reason: KeywordExclusionReason = "unsupported"


class CvStrategy(BaseModel):
    summary: str = ""
    primary_positioning: str = ""
    keywords_prioritized: list[str] = Field(default_factory=list)
    keywords_excluded: list[ExcludedKeyword] = Field(default_factory=list)


class SkillGroup(BaseModel):
    category: str = ""
    items: list[str] = Field(default_factory=list)


class CvBullet(BaseModel):
    text: str = Field(default="", max_length=BULLET_MAX_CHARS)
    source_evidence: str = ""
    truth_guard_status: TruthGuardStatus = "needs_confirmation"
    keywords_used: list[str] = Field(default_factory=list)


class WorkExperienceEntry(BaseModel):
    company: str = ""
    title: str = ""
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[CvBullet] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    name: str = ""
    description: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    bullets: list[CvBullet] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    school: str = ""
    degree: str | None = None
    field: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    details: str | None = None


class CertificationEntry(BaseModel):
    name: str = ""
    issuer: str | None = None
    date: str | None = None
    credential_url: str | None = None


class QualityNote(BaseModel):
    code: str
    detail: str


class RenderingRecommendation(BaseModel):
    """US-043: how the document should be rendered. ``recommended_page_count``
    is clamped server-side into the deterministic page policy's allowed range
    (``page_policy.clamp_page_count``); ``compression_strategy`` strings are
    rationale shown to the user — the server applies its own mechanical
    compression steps (US-045)."""

    recommended_page_count: int = Field(default=1, ge=1, le=3)
    page_count_reason: str = ""
    font_profile: FontProfile = "modern_latex"
    layout_density: LayoutDensity = "standard"
    compression_strategy: list[str] = Field(default_factory=list)


class DraftCvOutput(AIOutputBase):
    candidate: CandidateContact = Field(default_factory=CandidateContact)
    target_job: TargetJob = Field(default_factory=TargetJob)
    cv_strategy: CvStrategy = Field(default_factory=CvStrategy)
    professional_summary: str = ""
    skills: list[SkillGroup] = Field(default_factory=list)
    work_experience: list[WorkExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)
    quality_notes: list[QualityNote] = Field(default_factory=list)
    rendering_recommendation: RenderingRecommendation = Field(
        default_factory=RenderingRecommendation
    )
