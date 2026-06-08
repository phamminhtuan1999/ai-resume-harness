from pydantic import BaseModel, Field


class BasicInfo(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    current_title: str | None = None
    years_of_experience: float | None = Field(default=None, ge=0, le=60)


class ProfessionalSummary(BaseModel):
    resume_summary: str | None = None
    candidate_summary: str | None = None
    primary_engineering_background: str | None = None
    seniority_level: str | None = None


class SkillsProfile(BaseModel):
    programming_languages: list[str] = Field(default_factory=list)
    backend: list[str] = Field(default_factory=list)
    frontend: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    cloud_devops: list[str] = Field(default_factory=list)
    ai_ml: list[str] = Field(default_factory=list)
    testing: list[str] = Field(default_factory=list)
    accessibility: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)


class WorkExperienceItem(BaseModel):
    company: str | None = None
    title: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current_role: bool = False
    description: str | None = None
    bullet_points: list[str] = Field(default_factory=list)
    detected_skills: list[str] = Field(default_factory=list)
    detected_impact: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    project_name: str | None = None
    project_type: str | None = None
    description: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    key_features: list[str] = Field(default_factory=list)
    role_contribution: str | None = None
    impact: str | None = None
    links: list[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    school: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    dates: str | None = None
    details: str | None = None


class CertificationItem(BaseModel):
    name: str | None = None
    issuer: str | None = None
    date: str | None = None
    expiration_date: str | None = None
    credential_url: str | None = None


class AIMetadata(BaseModel):
    primary_role_family: str | None = None
    seniority_level: str | None = None
    strongest_skills: list[str] = Field(default_factory=list)
    weak_ai_role_areas: list[str] = Field(default_factory=list)
    suggested_target_roles: list[str] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    basic_info: BasicInfo = Field(default_factory=BasicInfo)
    professional_summary: ProfessionalSummary = Field(default_factory=ProfessionalSummary)
    skills: SkillsProfile = Field(default_factory=SkillsProfile)
    work_experience: list[WorkExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    certifications: list[CertificationItem] = Field(default_factory=list)
    ai_metadata: AIMetadata = Field(default_factory=AIMetadata)


class ProfileConfidence(BaseModel):
    overall: float = Field(ge=0, le=1)
    low_confidence_fields: list[str] = Field(default_factory=list)


class CandidateProfileDraft(BaseModel):
    candidate_profile: CandidateProfile
    confidence: ProfileConfidence


class CandidateProfileExtractResponse(CandidateProfileDraft):
    resume_id: str


class CandidateProfileImportRequest(BaseModel):
    resume_id: str
    candidate_profile: CandidateProfile
    confidence: ProfileConfidence = Field(
        default_factory=lambda: ProfileConfidence(overall=1, low_confidence_fields=[])
    )


class CandidateProfileImportResponse(BaseModel):
    profile_id: str
    resume_id: str
    profile_source: str
