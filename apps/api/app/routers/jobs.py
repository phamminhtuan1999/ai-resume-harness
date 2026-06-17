from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.job import (
    AiRelevancePreview,
    EmploymentType,
    JobExtractFromDescriptionRequest,
    JobExtraction,
    JobImportUrlRequest,
    JobImportUrlResponse,
    JobPreviewResponse,
    JobSearchRequest,
    JobSearchResponse,
    SearchJobResult,
    SearchQuickMatchPreview,
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
from app.services.job_search.enricher import SearchEnricher, run_relevance_preview
from app.services.job_search.normalizer import normalize_and_rank
from app.services.job_search.provider import (
    JobSearchNotConfiguredError,
    JobSearchProviderError,
    build_job_search_provider,
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
# Below this, a pasted description is too thin to extract or classify usefully.
_MIN_PASTE_CHARS = 40

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


@router.post("/search-ai", response_model=JobSearchResponse)
def search_ai_jobs(
    payload: JobSearchRequest,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JobSearchResponse:
    """Search live AI-engineering jobs via the configured provider (US-073/074).

    Results are transient — not persisted until the user clicks Save (US-077).
    Cost-safe pipeline (server-side; client cannot raise limits):
      fetch ≤50 → normalize+dedup+prefilter → AI relevance (≤20) →
      keep score ≥60 as visible → quick match on top ≤8 visible.
    """
    settings = get_settings()

    try:
        data_client = SupabaseDataClient(settings)
        profile_row = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile_row:
            raise HTTPException(status_code=404, detail="Profile not found.")
        user_profile_id = profile_row["id"]
        candidate_profile = data_client.get_candidate_profile(
            user_profile_id=user_profile_id
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(
            status_code=500, detail="Job data source is misconfigured."
        ) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Job data is unavailable.") from exc

    session_id = str(uuid4())

    try:
        provider = build_job_search_provider(settings)
        raw_jobs = provider.search(
            query=payload.target_role,
            location=payload.location,
            remote_only=payload.remote_only,
            results_per_page=settings.job_search_fetch_limit,
        )
    except JobSearchNotConfiguredError:
        return JobSearchResponse(
            search_session_id=session_id,
            total_provider_results=0,
            total_ai_related_results=0,
            jobs=[],
            error={
                "code": "search_not_configured",
                "message": (
                    "Job search is not configured. "
                    "Use Import Job URL or Paste Job Description instead."
                ),
            },
        )
    except JobSearchProviderError:
        return JobSearchResponse(
            search_session_id=session_id,
            total_provider_results=0,
            total_ai_related_results=0,
            jobs=[],
            error={
                "code": "search_unavailable",
                "message": (
                    "Job search is temporarily unavailable. "
                    "Try again, or use Import Job URL."
                ),
            },
        )

    ranked, _ = normalize_and_rank(
        raw_jobs,
        prefilter_limit=settings.job_search_prefilter_limit,
    )

    enricher = SearchEnricher(settings=settings)
    enriched = enricher.enrich(
        ranked,
        profile=candidate_profile,
        quick_match_limit=settings.job_search_quick_match_limit,
    )

    total_ai_visible = sum(1 for j in enriched if not j.get("hidden", False))
    jobs_out = []
    for j in enriched:
        ai_rel = j.get("ai_relevance")
        qm = j.get("quick_match")
        jobs_out.append(
            SearchJobResult(
                external_job_id=j["external_job_id"],
                external_source=j["external_source"],
                title=j["title"],
                company=j.get("company"),
                location=j.get("location"),
                description=j["description"],
                apply_url=j.get("apply_url"),
                pre_score=j.get("pre_score", 0),
                likely_ai_related=j.get("likely_ai_related", False),
                keyword_hits=j.get("keyword_hits", []),
                ai_relevance=AiRelevancePreview(**ai_rel) if ai_rel else None,
                quick_match=SearchQuickMatchPreview(**qm) if qm else None,
                hidden=j.get("hidden", False),
            )
        )

    return JobSearchResponse(
        search_session_id=session_id,
        total_provider_results=len(raw_jobs),
        total_ai_related_results=total_ai_visible,
        jobs=jobs_out,
    )


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


@router.post("/extract-from-description", response_model=JobPreviewResponse)
def extract_from_description(
    payload: JobExtractFromDescriptionRequest,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JobPreviewResponse:
    """Extract structured fields from a pasted job description + score relevance.

    The Paste JD path (US-076): the pasted text is run through AI extraction and
    the AI Role Relevance check, then returned as a preview. Nothing is saved —
    the user confirms (or edits uncertain fields) before Save / Save & Analyze.
    """
    settings = get_settings()

    text = (payload.raw_description or "").strip()
    if len(text) < _MIN_PASTE_CHARS:
        raise HTTPException(
            status_code=422,
            detail=(
                "This job description is too short to analyze. "
                "Paste the full posting so we can extract and check it."
            ),
        )

    try:
        extraction = extract_job_from_markdown(markdown=text, settings=settings)
    except JobExtractionServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except JobExtractionError as exc:
        raise HTTPException(
            status_code=502,
            detail="We could not read this description. Check the text and try again.",
        ) from exc

    # The user's typed title/company win over the model when provided.
    if payload.title and payload.title.strip():
        extraction.title = payload.title.strip()
    if payload.company and payload.company.strip():
        extraction.company = payload.company.strip()

    return _build_preview(extraction, raw_text=text, settings=settings)


@router.post("/preview-url", response_model=JobPreviewResponse)
def preview_job_by_url(
    payload: JobImportUrlRequest,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JobPreviewResponse:
    """Fetch + extract a job by URL and score relevance — WITHOUT saving (US-076).

    The non-saving twin of ``import-url``: it returns the same extracted fields
    plus the AI Role Relevance preview so the user can confirm before committing.
    Saving stays an explicit, user-confirmed action (mechanics in US-077). On a
    fetch/extract failure the user is offered the Paste JD fallback, exactly as
    ``import-url`` does today.
    """
    settings = get_settings()

    try:
        source_url, normalized_url = validate_and_normalize_url(payload.source_url)
    except InvalidJobUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Surface an existing save so the UI can route to it instead of re-importing.
    try:
        data_client = SupabaseDataClient(settings)
        profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found.")
        existing = data_client.find_job_by_normalized_url(
            user_profile_id=profile["id"], normalized_url=normalized_url
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(
            status_code=500, detail="Job data source is misconfigured."
        ) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Job data is unavailable.") from exc

    try:
        markdown = scrape_job_page(url=source_url, settings=settings)
    except FirecrawlNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=_MANUAL_FALLBACK_DETAIL) from exc
    except (FirecrawlFetchError, FirecrawlError) as exc:
        raise HTTPException(status_code=502, detail=_MANUAL_FALLBACK_DETAIL) from exc

    try:
        extraction = extract_job_from_markdown(markdown=markdown, settings=settings)
    except JobExtractionServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except JobExtractionError as exc:
        raise HTTPException(status_code=502, detail=_MANUAL_FALLBACK_DETAIL) from exc

    if not (extraction.company or "").strip():
        extraction.company = fallback_company_from_url(normalized_url)

    raw_text = (extraction.raw_description or "").strip() or markdown.strip()
    return _build_preview(
        extraction,
        raw_text=raw_text,
        settings=settings,
        source_url=source_url,
        normalized_url=normalized_url,
        duplicate=bool(existing),
        duplicate_job_id=str(existing["id"]) if existing else None,
    )


def _build_preview(
    extraction: JobExtraction,
    *,
    raw_text: str,
    settings: object,
    source_url: str | None = None,
    normalized_url: str | None = None,
    duplicate: bool = False,
    duplicate_job_id: str | None = None,
) -> JobPreviewResponse:
    """Assemble a JobPreviewResponse: normalize fields + run AI relevance.

    Relevance degrades gracefully: if the classifier raises, the preview is
    returned extraction-only with ``relevance_available=False`` rather than
    failing the whole request.
    """
    title = (extraction.title or "").strip()
    company = (extraction.company or "").strip()
    raw_description = raw_text[:_MAX_RAW_DESCRIPTION_CHARS]

    ai_relevance: AiRelevancePreview | None = None
    relevance_available = True
    try:
        snapshot = run_relevance_preview(
            {
                "title": title,
                "company": company,
                "raw_description": raw_description,
            },
            settings=settings,
        )
        ai_relevance = AiRelevancePreview(**snapshot)
    except Exception:
        relevance_available = False

    return JobPreviewResponse(
        title=title or None,
        company=company or None,
        location=_clean(extraction.location),
        work_type=_normalize_choice(extraction.work_type, _WORK_TYPE_ALIASES, "unknown"),
        employment_type=_normalize_choice(
            extraction.employment_type, _EMPLOYMENT_TYPE_ALIASES, "unknown"
        ),
        salary_range=_clean(extraction.salary_range),
        responsibilities=extraction.responsibilities,
        required_skills=extraction.required_skills,
        preferred_skills=extraction.preferred_skills,
        required_experience_years=_clean(extraction.required_experience_years),
        ai_related_requirements=extraction.ai_related_requirements,
        cloud_requirements=extraction.cloud_requirements,
        raw_description=raw_description,
        extraction_confidence=extraction.confidence_score,
        needs_confirmation=_needs_confirmation(title, company),
        ai_relevance=ai_relevance,
        relevance_available=relevance_available,
        source_url=source_url,
        normalized_url=normalized_url,
        duplicate=duplicate,
        duplicate_job_id=duplicate_job_id,
    )


def _needs_confirmation(title: str, company: str) -> bool:
    """True when title or company is missing — the UI asks the user to confirm.

    Section 9 rule: do not invent missing fields. A blank key field is shown for
    the user to fill rather than guessed.
    """
    return not title.strip() or not company.strip()


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
