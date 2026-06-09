"""Interview prep endpoints (US-035), mounted under ``/api/matches``.

Reuses the shared match-workflow runner from the matches router so the
US-027 envelope / error translation stays in one place. The GET maps the
persisted ``interview_preps`` columns back to the Feature 7.4 output shape so
the page renders the saved prep without re-running the model.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import AuthenticatedUser, require_authenticated_user
from app.routers.matches import _data_client, _resolve_profile, _run_match_workflow
from app.services.ai.interview_prep_workflow import InterviewPrepWorkflow
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataError,
)

router = APIRouter()


@router.post("/{match_id}/interview-prep")
def interview_prep(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        InterviewPrepWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/interview-prep/regenerate")
def regenerate_interview_prep(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        InterviewPrepWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/interview-prep")
def get_interview_prep(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Return the persisted prep mapped back to the 7.4 output shape, plus the run."""
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        row = data_client.get_interview_prep_by_match(
            match_id=match_id, user_profile_id=user_profile_id
        )
        run = data_client.get_latest_workflow_run(
            match_id=match_id,
            user_profile_id=user_profile_id,
            workflow_type="interview_prep",
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Interview prep not found.")

    questions = row.get("questions_json") or {}
    study_plan = row.get("study_plan_json") or {}
    return JSONResponse(
        status_code=200,
        content={
            "match_id": match_id,
            "workflow_run": run,
            "result": {
                "prep_summary": (
                    study_plan.get("prep_summary") if isinstance(study_plan, dict) else ""
                )
                or "",
                "technical_questions": questions.get("technical_questions") or [],
                "ai_llm_questions": questions.get("ai_llm_questions") or [],
                "system_design_questions": questions.get("system_design_questions") or [],
                "behavioral_questions": questions.get("behavioral_questions") or [],
                "weak_topics_to_study": row.get("weak_topics_json") or [],
                "answer_guidance": row.get("answer_guidance_json") or [],
                "saved_at": row.get("updated_at"),
            },
        },
    )
