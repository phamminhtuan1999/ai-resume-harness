from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, profile, resumes
from app.settings import get_settings

settings = get_settings()

app = FastAPI(
    title="ApplyWise API",
    version="0.1.0",
    docs_url="/docs" if settings.api_env == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
