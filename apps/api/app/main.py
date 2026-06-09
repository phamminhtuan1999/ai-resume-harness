from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    activities,
    dashboard,
    health,
    interview_prep,
    jobs,
    matches,
    profile,
    resume_suggestions,
    resumes,
)
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
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(
    interview_prep.router, prefix="/api/matches", tags=["interview-prep"]
)
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(
    resume_suggestions.router,
    prefix="/api/resume-suggestions",
    tags=["resume-suggestions"],
)
