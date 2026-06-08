from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.candidate_profile import (
    CandidateProfileImportRequest,
    CandidateProfileImportResponse,
)
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.settings import get_settings

router = APIRouter()


@router.post("/import-from-resume", response_model=CandidateProfileImportResponse)
def import_from_resume(
    request: CandidateProfileImportRequest,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> CandidateProfileImportResponse:
    settings = get_settings()

    try:
        data_client = SupabaseDataClient(settings)
        profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found.")

        resume = data_client.get_owned_resume(
            resume_id=request.resume_id,
            user_profile_id=profile["id"],
        )
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found.")

        saved_profile = data_client.save_candidate_profile(
            user_profile_id=profile["id"],
            resume_id=request.resume_id,
            candidate_profile=request.candidate_profile,
            confidence=request.confidence,
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(
            status_code=500, detail="Profile data source is misconfigured."
        ) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Profile data is unavailable.") from exc

    return CandidateProfileImportResponse(
        profile_id=saved_profile["id"],
        resume_id=request.resume_id,
        profile_source=saved_profile.get("profile_source") or "resume_import",
    )
