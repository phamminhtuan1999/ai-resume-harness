from typing import Literal

from pydantic import BaseModel, Field

WorkType = Literal["remote", "hybrid", "onsite", "unknown"]
EmploymentType = Literal["full-time", "contract", "internship", "unknown"]


class JobExtraction(BaseModel):
    """Strict schema the AI must return from fetched job-page content.

    Every field is optional or defaulted so a partial page still yields a usable
    job. Provider/model output is untrusted: ``work_type``/``employment_type``
    are free text here and normalized to the allowed sets after parsing.
    """

    title: str | None = None
    company: str | None = None
    location: str | None = None
    work_type: str | None = None
    employment_type: str | None = None
    salary_range: str | None = None
    role_summary: str | None = None
    about_company: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    required_experience_years: str | None = None
    ai_related_requirements: list[str] = Field(default_factory=list)
    cloud_requirements: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    raw_description: str | None = None
    confidence_score: float = Field(default=0.0, ge=0, le=1)


class JobImportUrlRequest(BaseModel):
    source_url: str


class JobSearchFilters(BaseModel):
    only_ai_related: bool = True
    hide_research_heavy: bool = True
    hide_non_engineering_ai: bool = True
    prioritize_transition_friendly: bool = True


class JobSearchRequest(BaseModel):
    target_role: str = "Applied AI Engineer"
    location: str = "Remote US"
    remote_only: bool = False
    experience_level: str | None = None
    # Provider result page for "Load more". Capped server-side so the per-search
    # cost stays bounded no matter what the client sends.
    page: int = Field(default=1, ge=1, le=10)
    filters: JobSearchFilters = Field(default_factory=JobSearchFilters)


class AiRelevancePreview(BaseModel):
    """AI Role Relevance result for a pre-save search result (Section 13)."""

    is_ai_related: bool
    ai_relevance_score: int
    ai_role_category: str
    transition_friendliness: str
    research_heavy: bool
    engineering_focused: bool
    relevance_reason: str
    detected_ai_keywords: list[str] = Field(default_factory=list)
    exclude_reason: str | None = None


class SearchQuickMatchPreview(BaseModel):
    """Pre-save quick match preview for a search result (Section 15)."""

    preview_match_score: int
    match_label: str
    assistant_preview: str
    recommended_action: str
    unavailable: bool = False


class SearchJobResult(BaseModel):
    external_job_id: str
    external_source: str
    title: str
    company: str | None = None
    location: str | None = None
    description: str
    apply_url: str | None = None
    posted_at: str | None = None
    salary_range: str | None = None
    pre_score: int
    likely_ai_related: bool
    keyword_hits: list[str] = Field(default_factory=list)
    ai_relevance: AiRelevancePreview | None = None
    quick_match: SearchQuickMatchPreview | None = None
    hidden: bool = False


class JobSearchResponse(BaseModel):
    search_session_id: str
    total_provider_results: int
    total_ai_related_results: int
    jobs: list[SearchJobResult]
    page: int = 1
    has_more: bool = False
    error: dict | None = None


class JobExtractFromDescriptionRequest(BaseModel):
    """Pasted job description to extract structured fields from (US-076)."""

    raw_description: str
    title: str | None = None
    company: str | None = None


class JobPreviewResponse(BaseModel):
    """Pre-save preview of an extracted job + its AI relevance (US-076).

    Returned by both the paste (``extract-from-description``) and URL
    (``preview-url``) paths. Nothing is persisted — the user confirms first.
    ``needs_confirmation`` is set when title/company could not be extracted
    confidently, so the UI asks the user to confirm or edit before saving.
    URL-only fields (``source_url`` … ``duplicate_job_id``) stay null for paste.
    """

    title: str | None = None
    company: str | None = None
    location: str | None = None
    work_type: WorkType = "unknown"
    employment_type: EmploymentType = "unknown"
    salary_range: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    required_experience_years: str | None = None
    ai_related_requirements: list[str] = Field(default_factory=list)
    cloud_requirements: list[str] = Field(default_factory=list)
    raw_description: str
    extraction_confidence: float = 0.0
    needs_confirmation: bool = False
    # AI Role Relevance (US-072). ``relevance_available`` is false when the
    # classifier could not run and the preview degrades to extraction-only.
    ai_relevance: AiRelevancePreview | None = None
    relevance_available: bool = True
    # URL-import-only provenance + dedup.
    source_url: str | None = None
    normalized_url: str | None = None
    duplicate: bool = False
    duplicate_job_id: str | None = None


IntakeSource = Literal["discovered_api", "manual_url", "manual_paste"]


class JobSaveExternalRequest(BaseModel):
    """Persist a job from any intake mode (search / URL / paste) at Save (US-077).

    The AI Role Relevance and Quick Match results are computed pre-save and held
    in memory (decision 0026); they ride along here and are mirrored onto the
    ``jobs`` denormalized columns at insert time. ``external_*`` identity is set
    only for ``discovered_api`` (search) results; URL/paste carry ``source_url``
    / ``normalized_url`` instead.
    """

    source: IntakeSource
    title: str
    company: str | None = None
    location: str | None = None
    work_type: WorkType = "unknown"
    employment_type: EmploymentType = "unknown"
    salary_range: str | None = None
    raw_description: str
    # URL / paste provenance
    source_url: str | None = None
    normalized_url: str | None = None
    # External provider identity (search results only)
    external_source: str | None = None
    external_job_id: str | None = None
    external_apply_url: str | None = None
    external_raw_payload: dict | None = None
    # Extraction detail (mirrored into extraction_json)
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    required_experience_years: str | None = None
    ai_related_requirements: list[str] = Field(default_factory=list)
    cloud_requirements: list[str] = Field(default_factory=list)
    extraction_confidence: float = 0.0
    # AI judgments (in-memory until save) — never conflated (Principle 2).
    ai_relevance: AiRelevancePreview | None = None
    quick_match: SearchQuickMatchPreview | None = None


class JobSaveResponse(BaseModel):
    """Result of a save: the persisted (or pre-existing) job's id + identity."""

    job_id: str
    duplicate: bool = False
    title: str
    company: str | None = None


class JobImportUrlResponse(BaseModel):
    job_id: str
    duplicate: bool = False
    source_url: str
    normalized_url: str
    company: str
    title: str
    location: str | None = None
    work_type: WorkType = "unknown"
    employment_type: EmploymentType = "unknown"
    salary_range: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    required_experience_years: str | None = None
    ai_related_requirements: list[str] = Field(default_factory=list)
    cloud_requirements: list[str] = Field(default_factory=list)
    raw_description: str
    extraction_confidence: float = 0.0
