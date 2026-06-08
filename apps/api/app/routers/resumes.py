from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.candidate_profile import CandidateProfileExtractResponse
from app.schemas.resume import ResumeImportPreview
from app.services.candidate_profile_extractor import (
    CandidateProfileExtractionError,
    CandidateProfileServiceUnavailableError,
    extract_candidate_profile_from_text,
)
from app.services.resume_import import SUPPORTED_MIME_TYPES, import_resume_file
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.settings import get_settings

router = APIRouter()


@router.post("/import/preview", response_model=ResumeImportPreview)
async def import_preview(
    file: UploadFile = File(...),
    _user: AuthenticatedUser = Depends(require_authenticated_user),
) -> ResumeImportPreview:
    settings = get_settings()
    content = await file.read()

    if len(content) > settings.resume_import_max_bytes:
        raise HTTPException(status_code=413, detail="Resume file is too large.")

    if file.content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported resume file type.")

    return import_resume_file(
        file_name=file.filename or "resume",
        mime_type=file.content_type or "application/octet-stream",
        content=content,
    )


@router.post("/{resume_id}/extract-profile", response_model=CandidateProfileExtractResponse)
def extract_profile(
    resume_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> CandidateProfileExtractResponse:
    settings = get_settings()

    try:
        data_client = SupabaseDataClient(settings)
        profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found.")

        resume = data_client.get_owned_resume(
            resume_id=resume_id,
            user_profile_id=profile["id"],
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(
            status_code=500, detail="Profile data source is misconfigured."
        ) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Profile data is unavailable.") from exc

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    raw_text = str(resume.get("raw_text") or "").strip()
    if not raw_text:
        raise HTTPException(status_code=422, detail="Resume has no extracted text.")

    try:
        draft = extract_candidate_profile_from_text(resume_text=raw_text, settings=settings)
    except CandidateProfileServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except CandidateProfileExtractionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CandidateProfileExtractResponse(
        resume_id=resume_id,
        candidate_profile=draft.candidate_profile,
        confidence=draft.confidence,
    )
