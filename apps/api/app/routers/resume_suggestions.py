"""Per-row resume suggestion updates (US-031).

Match-independent endpoint: ``PATCH /api/resume-suggestions/{suggestionId}``
updates one row's ``user_action`` (Accept/Reject) and optionally its
``suggested_text`` (the inline Edit flow). Ownership is asserted by joining
through ``matches.user_id``; a row the user does not own returns the standard
``unauthorized`` (403) envelope and is never modified.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import AuthenticatedUser, require_authenticated_user
from app.services.ai.errors import UnauthorizedError
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.settings import get_settings

router = APIRouter()


class SuggestionPatch(BaseModel):
    user_action: Literal["accepted", "rejected", "pending"]
    suggested_text: str | None = None


def _data_client() -> SupabaseDataClient:
    try:
        return SupabaseDataClient(get_settings())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc


@router.patch("/{suggestion_id}")
def patch_resume_suggestion(
    suggestion_id: str,
    body: SuggestionPatch,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    data_client = _data_client()
    try:
        profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found.")
        row = data_client.patch_suggestion_user_action(
            suggestion_id=suggestion_id,
            user_profile_id=profile["id"],
            user_action=body.user_action,
            suggested_text=body.suggested_text,
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    if row is None:
        error = UnauthorizedError("You do not have access to this suggestion.")
        return JSONResponse(status_code=error.http_status, content=error.to_envelope())
    return JSONResponse(status_code=200, content={"suggestion": row})
