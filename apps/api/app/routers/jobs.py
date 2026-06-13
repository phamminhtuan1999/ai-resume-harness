from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.job import (
    EmploymentType,
    JobExtraction,
    JobImportUrlRequest,
    JobImportUrlResponse,
    WorkType,
)
from app.services.ai.errors import AIWorkflowError
from app.services.ai.quick_match_workflow import QuickMatchWorkflow
from app.services.firecrawl_client import (
    FirecrawlError,
    FirecrawlFetchError,
    FirecrawlNotConfiguredError,
    scrape_job_page,
)
from app.services.job_extractor import (
    JobExtractionError,
    JobExtractionServiceUnavailableError,
    extract_job_from_markdown,
)
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.services.url_normalize import (
    InvalidJobUrlError,
    fallback_company_from_url,
    validate_and_normalize_url,
)
from app.settings import get_settings

router = APIRouter()

# Shown when the page cannot be fetched or read. The UI offers manual paste.
_MANUAL_FALLBACK_DETAIL = (
    "We could not fetch this job page. Paste the job description manually."
)
_MAX_RAW_DESCRIPTION_CHARS = 24_000

_WORK_TYPE_ALIASES: dict[str, WorkType] = {
    "remote": "remote",
    "fully remote": "remote",
    "work from home": "remote",
    "wfh": "remote",
    "hybrid": "hybrid",
    "onsite": "onsite",
    "on-site": "onsite",
    "on site": "onsite",
    "in office": "onsite",
    "in-office": "onsite",
}
_EMPLOYMENT_TYPE_ALIASES: dict[str, EmploymentType] = {
    "full-time": "full-time",
    "full time": "full-time",
    "fulltime": "full-time",
    "permanent": "full-time",
    "contract": "contract",
    "contractor": "contract",
    "freelance": "contract",
    "temporary": "contract",
    "internship": "internship",
    "intern": "internship",
}


@router.post("/import-url", response_model=JobImportUrlResponse)
def import_job_by_url(
    payload: JobImportUrlRequest,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JobImportUrlResponse:
    settings = get_settings()

    try:
        source_url, normalized_url = validate_and_normalize_url(payload.source_url)
    except InvalidJobUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        data_client = SupabaseDataClient(settings)
        profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found.")
        user_profile_id = profile["id"]
        existing = data_client.find_job_by_normalized_url(
            user_profile_id=user_profile_id, normalized_url=normalized_url
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(
            status_code=500, detail="Job data source is misconfigured."
        ) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Job data is unavailable.") from exc

    if existing:
        return JobImportUrlResponse(
            job_id=str(existing["id"]),
            duplicate=True,
            source_url=existing.get("source_url") or source_url,
            normalized_url=normalized_url,
            company=existing.get("company") or fallback_company_from_url(normalized_url),
            title=existing.get("title") or "Imported role",
            raw_description="",
        )

    try:
        markdown = scrape_job_page(url=source_url, settings=settings)
    except FirecrawlNotConfiguredError as exc:
        # No provider configured: degrade to the manual-paste fallback, the same
        # experience the user gets when a page cannot be fetched.
        raise HTTPException(status_code=503, detail=_MANUAL_FALLBACK_DETAIL) from exc
    except FirecrawlFetchError as exc:
        raise HTTPException(status_code=502, detail=_MANUAL_FALLBACK_DETAIL) from exc
    except FirecrawlError as exc:
        raise HTTPException(status_code=502, detail=_MANUAL_FALLBACK_DETAIL) from exc

    try:
        extraction = extract_job_from_markdown(markdown=markdown, settings=settings)
    except JobExtractionServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except JobExtractionError as exc:
        raise HTTPException(status_code=502, detail=_MANUAL_FALLBACK_DETAIL) from exc

    company = (extraction.company or "").strip() or fallback_company_from_url(
        normalized_url
    )
    title = (extraction.title or "").strip() or "Imported role"
    work_type = _normalize_choice(extraction.work_type, _WORK_TYPE_ALIASES, "unknown")
    employment_type = _normalize_choice(
        extraction.employment_type, _EMPLOYMENT_TYPE_ALIASES, "unknown"
    )
    raw_description = (
        (extraction.raw_description or "").strip() or markdown.strip()
    )[:_MAX_RAW_DESCRIPTION_CHARS]

    job_row = {
        "company": company,
        "title": title,
        "location": _clean(extraction.location),
        "work_type": work_type,
        "employment_type": employment_type,
        "salary_range": _clean(extraction.salary_range),
        "raw_description": raw_description,
        "job_url": source_url,
        "source": "manual_url",
        "source_url": source_url,
        "normalized_url": normalized_url,
        "parse_status": "parsed",
        "extraction_status": "succeeded",
        "extraction_confidence": extraction.confidence_score,
        "extraction_json": _extraction_payload(extraction),
    }

    try:
        saved = data_client.insert_job(user_profile_id=user_profile_id, job=job_row)
    except SupabaseConfigurationError as exc:
        raise HTTPException(
            status_code=500, detail="Job data source is misconfigured."
        ) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Job data is unavailable.") from exc

    return JobImportUrlResponse(
        job_id=str(saved["id"]),
        duplicate=False,
        source_url=source_url,
        normalized_url=normalized_url,
        company=company,
        title=title,
        location=job_row["location"],
        work_type=work_type,
        employment_type=employment_type,
        salary_range=job_row["salary_range"],
        responsibilities=extraction.responsibilities,
        required_skills=extraction.required_skills,
        preferred_skills=extraction.preferred_skills,
        required_experience_years=_clean(extraction.required_experience_years),
        ai_related_requirements=extraction.ai_related_requirements,
        cloud_requirements=extraction.cloud_requirements,
        raw_description=raw_description,
        extraction_confidence=extraction.confidence_score,
    )


@router.post("/{job_id}/quick-match")
def quick_match_job(
    job_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Run an explicit AI quick match for one saved job (US-068).

    Manual, per-job, and uncapped — the user asked for this one (the
    ``AI_QUICK_MATCH_LIMIT`` cap only bounds automatic batch previews). Runs the
    standard workflow path (fast tier, ``ai_workflow_runs``) and returns the
    standard envelope; typed ``AIWorkflowError`` failures become a friendly,
    retryable ``{ error: {...} }`` so the listing stays usable on quota errors."""
    settings = get_settings()
    try:
        data_client = SupabaseDataClient(settings)
        profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found.")
        user_profile_id = profile["id"]
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Job data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Job data is unavailable.") from exc

    workflow = QuickMatchWorkflow(data_client=data_client, settings=settings)
    try:
        result = workflow.run(
            subject_id=job_id,
            user_profile_id=user_profile_id,
            request_id=request.headers.get("x-request-id"),
        )
    except AIWorkflowError as exc:
        return JSONResponse(status_code=exc.http_status, content=exc.to_envelope())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Job data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Job data is unavailable.") from exc

    return JSONResponse(status_code=200, content=result)


def _normalize_choice(value: str | None, aliases: dict[str, str], default: str) -> str:
    if not value:
        return default
    return aliases.get(value.strip().lower(), default)


def _clean(value: str | None) -> str | None:
    cleaned = (value or "").strip()
    return cleaned or None


def _extraction_payload(extraction: JobExtraction) -> dict:
    return extraction.model_dump(mode="json")
