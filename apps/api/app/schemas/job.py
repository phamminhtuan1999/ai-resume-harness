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
    error: dict | None = None


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
