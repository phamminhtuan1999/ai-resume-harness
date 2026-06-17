from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APPLYWISE_",
        env_file=".env.local",
        extra="ignore",
    )

    api_env: str = Field(default="development", alias="APPLYWISE_API_ENV")
    allowed_origins: str = Field(default="http://localhost:3000", alias="APPLYWISE_ALLOWED_ORIGINS")
    resume_import_max_bytes: int = Field(default=10_485_760, alias="RESUME_IMPORT_MAX_BYTES")
    resume_import_timeout_seconds: int = Field(default=45, alias="RESUME_IMPORT_TIMEOUT_SECONDS")
    clerk_secret_key: str = Field(default="", alias="CLERK_SECRET_KEY")
    clerk_jwks_url: str = Field(default="", alias="CLERK_JWKS_URL")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    # US-069: selects which provider adapter the workflow foundation builds.
    # Default 'gemini' keeps every existing deployment byte-for-byte unchanged.
    # An unknown name fails fast at first use with a clear configuration error.
    ai_provider: str = Field(default="gemini", alias="AI_PROVIDER")
    # The default tier (US-066). Fast/heavy tiers fall back to this when unset,
    # so a deployment with only GEMINI_MODEL keeps its current model on every task.
    gemini_model: str = Field(default="gemini-3.5-flash", alias="GEMINI_MODEL")
    gemini_fast_model: str = Field(default="", alias="GEMINI_FAST_MODEL")
    gemini_heavy_model: str = Field(default="", alias="GEMINI_HEAVY_MODEL")
    ai_use_heavy_model_for_draft_cv: bool = Field(
        default=False, alias="AI_USE_HEAVY_MODEL_FOR_DRAFT_CV"
    )
    firecrawl_api_key: str = Field(default="", alias="FIRECRAWL_API_KEY")
    firecrawl_api_base: str = Field(
        default="https://api.firecrawl.dev", alias="FIRECRAWL_API_BASE"
    )
    firecrawl_timeout_seconds: int = Field(
        default=45, ge=1, alias="FIRECRAWL_TIMEOUT_SECONDS"
    )
    # US-068: an upper bound on how many top pre-scored jobs may receive an
    # automatic quick match in any batch path; enforced server-side.
    ai_quick_match_limit: int = Field(default=5, ge=0, alias="AI_QUICK_MATCH_LIMIT")
    gemini_max_attempts: int = Field(default=3, ge=1, alias="GEMINI_MAX_ATTEMPTS")
    gemini_retry_base_delay_seconds: float = Field(
        default=0.5, ge=0, alias="GEMINI_RETRY_BASE_DELAY_SECONDS"
    )
    # US-073: job search provider (decision 0025). Provider swap is config-only.
    # Absence of keys is a state, not a crash: the endpoint returns a friendly
    # "search not configured" envelope so Import URL / Paste JD remain usable.
    job_search_provider: str = Field(default="adzuna", alias="JOB_SEARCH_PROVIDER")
    adzuna_app_id: str = Field(default="", alias="ADZUNA_APP_ID")
    adzuna_app_key: str = Field(default="", alias="ADZUNA_APP_KEY")
    adzuna_api_base: str = Field(
        default="https://api.adzuna.com/v1/api", alias="ADZUNA_API_BASE"
    )
    adzuna_search_country: str = Field(default="us", alias="ADZUNA_SEARCH_COUNTRY")
    adzuna_timeout_seconds: int = Field(default=30, ge=1, alias="ADZUNA_TIMEOUT_SECONDS")
    # Cost-safe pipeline caps (server-side; client cannot raise these limits).
    job_search_fetch_limit: int = Field(default=50, ge=1, alias="JOB_SEARCH_FETCH_LIMIT")
    job_search_prefilter_limit: int = Field(
        default=20, ge=1, alias="JOB_SEARCH_PREFILTER_LIMIT"
    )
    job_search_quick_match_limit: int = Field(
        default=8, ge=0, alias="JOB_SEARCH_QUICK_MATCH_LIMIT"
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Comma-separated APPLYWISE_ALLOWED_ORIGINS parsed into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
