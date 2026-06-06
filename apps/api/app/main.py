from fastapi import FastAPI

from app.routers import health, resumes
from app.settings import get_settings

settings = get_settings()

app = FastAPI(
    title="ApplyWise API",
    version="0.1.0",
    docs_url="/docs" if settings.api_env == "development" else None,
)

app.include_router(health.router)
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])

