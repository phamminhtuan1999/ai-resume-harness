import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    activities,
    dashboard,
    draft_cvs,
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

# Uvicorn only configures its own loggers; without a root handler the
# applywise.* INFO lines (including the per-run AI logs) are dropped.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
# Every Supabase/Gemini HTTP call logs a request line at INFO otherwise.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger("applywise.api")


def _configured(present: bool) -> str:
    return "configured" if present else "MISSING"


logger.info(
    "\n".join(
        [
            "ApplyWise API starting",
            f"  env       : {settings.api_env}",
            (
                f"  gemini    : {settings.gemini_model}"
                f" (attempts={settings.gemini_max_attempts},"
                f" api key {_configured(bool(settings.gemini_api_key))})"
            ),
            f"  supabase  : {_configured(bool(settings.supabase_url and settings.supabase_service_role_key))}",
            # JWKS comes from the token issuer unless clerk_jwks_url overrides it.
            f"  clerk     : {_configured(bool(settings.clerk_secret_key or settings.clerk_jwks_url))}",
            f"  firecrawl : {_configured(bool(settings.firecrawl_api_key))}",
        ]
    )
)

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
# Mounted at /api: owns both /api/matches/{id}/draft-cv and /api/draft-cvs/{id}.
app.include_router(draft_cvs.router, prefix="/api", tags=["draft-cvs"])
