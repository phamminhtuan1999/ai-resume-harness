"""Dashboard AI summary endpoints (US-036), mounted under ``/api/dashboard``.

The §9 data gate (fewer than 3 completed match/gap analyses) is enforced here,
before the workflow runs, so a gated request makes no model call and writes no
run row. GET serves the cached ``dashboard_ai_summary`` row; POST generates
(returning the cached row unless ``force``); ``/regenerate`` always re-runs.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import AuthenticatedUser, require_authenticated_user
from app.routers.matches import _data_client, _resolve_profile
from app.schemas.dashboard import MIN_ANALYZED_JOBS, not_enough_data_result
from app.services.ai.dashboard_summary_workflow import DashboardSummaryWorkflow
from app.services.ai.errors import AIWorkflowError
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.settings import get_settings

router = APIRouter()


class GenerateSummaryBody(BaseModel):
    force: bool = False


def _summary_envelope(row: dict, run: dict | None) -> dict:
    return {
        "workflow_run": run,
        "result": {
            "dashboard_summary": row.get("dashboard_summary") or "",
            "best_fit_roles": row.get("best_fit_roles_json") or [],
            "repeated_skill_gaps": row.get("repeated_skill_gaps_json") or [],
            "job_search_health": row.get("job_search_health") or "not_enough_data",
            "recommended_next_actions": row.get("recommended_next_actions_json") or [],
            "confidence_score": row.get("confidence_score"),
            "provider": row.get("provider"),
            "saved_at": row.get("updated_at"),
        },
    }


def _gated(data_client: SupabaseDataClient, user_profile_id: str) -> bool:
    return (
        data_client.count_analyzed_jobs(user_profile_id=user_profile_id)
        < MIN_ANALYZED_JOBS
    )


def _generate(
    *, request: Request, user: AuthenticatedUser, force: bool
) -> JSONResponse:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)

        if _gated(data_client, user_profile_id):
            return JSONResponse(
                status_code=200,
                content={"workflow_run": None, "result": not_enough_data_result()},
            )

        if not force:
            row = data_client.get_dashboard_ai_summary(user_profile_id=user_profile_id)
            if row:
                run = data_client.get_latest_run_for_user(
                    user_profile_id=user_profile_id, workflow_type="dashboard_summary"
                )
                return JSONResponse(status_code=200, content=_summary_envelope(row, run))
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Dashboard data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Dashboard data is unavailable.") from exc

    workflow = DashboardSummaryWorkflow(data_client=data_client, settings=get_settings())
    try:
        result = workflow.run(
            subject_id=None,
            user_profile_id=user_profile_id,
            regenerate=force,
            request_id=request.headers.get("x-request-id"),
        )
    except AIWorkflowError as exc:
        return JSONResponse(status_code=exc.http_status, content=exc.to_envelope())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Dashboard data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Dashboard data is unavailable.") from exc

    return JSONResponse(status_code=200, content=result)


@router.post("/ai-summary")
def generate_ai_summary(
    request: Request,
    body: GenerateSummaryBody | None = None,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _generate(request=request, user=user, force=bool(body and body.force))


@router.post("/ai-summary/regenerate")
def regenerate_ai_summary(
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _generate(request=request, user=user, force=True)


@router.get("/ai-summary")
def get_ai_summary(
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> Response:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)

        if _gated(data_client, user_profile_id):
            return JSONResponse(
                status_code=200,
                content={"workflow_run": None, "result": not_enough_data_result()},
            )

        row = data_client.get_dashboard_ai_summary(user_profile_id=user_profile_id)
        if not row:
            return Response(status_code=204)
        run = data_client.get_latest_run_for_user(
            user_profile_id=user_profile_id, workflow_type="dashboard_summary"
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Dashboard data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Dashboard data is unavailable.") from exc

    return JSONResponse(status_code=200, content=_summary_envelope(row, run))
