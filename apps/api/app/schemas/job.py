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
