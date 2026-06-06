from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APPLYWISE_", env_file=".env.local")

    api_env: str = Field(default="development", alias="APPLYWISE_API_ENV")
    allowed_origins: str = Field(default="http://localhost:3000", alias="APPLYWISE_ALLOWED_ORIGINS")
    resume_import_max_bytes: int = Field(default=10_485_760, alias="RESUME_IMPORT_MAX_BYTES")
    resume_import_timeout_seconds: int = Field(default=45, alias="RESUME_IMPORT_TIMEOUT_SECONDS")


@lru_cache
def get_settings() -> Settings:
    return Settings()

