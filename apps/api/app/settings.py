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
    # No-auth preview identity: in preview mode (APPLYWISE_API_ENV=preview) only,
    # token-less requests resolve to this Clerk user id — the Playwright test
    # profile — so the preview backend serves real, seeded data. Requests that
    # carry a token are always verified normally, so real browsers and the E2E
    # suite are unaffected; development/production never trigger it.
    preview_clerk_user_id: str = Field(
        default="", alias="APPLYWISE_PREVIEW_CLERK_USER_ID"
    )
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3.5-flash", alias="GEMINI_MODEL")
    firecrawl_api_key: str = Field(default="", alias="FIRECRAWL_API_KEY")
    firecrawl_api_base: str = Field(
        default="https://api.firecrawl.dev", alias="FIRECRAWL_API_BASE"
    )
    firecrawl_timeout_seconds: int = Field(
        default=45, ge=1, alias="FIRECRAWL_TIMEOUT_SECONDS"
    )
    gemini_max_attempts: int = Field(default=3, ge=1, alias="GEMINI_MAX_ATTEMPTS")
    gemini_retry_base_delay_seconds: float = Field(
        default=0.5, ge=0, alias="GEMINI_RETRY_BASE_DELAY_SECONDS"
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Comma-separated APPLYWISE_ALLOWED_ORIGINS parsed into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
