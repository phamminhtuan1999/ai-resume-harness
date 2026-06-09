"""Activity feed endpoints (US-037), mounted under ``/api/activities``.

Read-heavy: most ``assistant_description`` values are written inline by the
originating workflows. ``POST /{id}/generate-description`` is the regenerate
escape hatch — it reconstructs a safe event context from the row, its joined
job, and the originating run's snapshot, re-runs the helper, records an
``activity_description`` run for observability, and updates the row in place.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.auth import AuthenticatedUser, require_authenticated_user
from app.routers.matches import _data_client, _resolve_profile
from app.services.ai.activity_description import (
    ActivityDescriptionHelper,
    fallback_description,
)
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataError,
)
from app.settings import get_settings

router = APIRouter()

# Snapshot keys safe to feed back into the description prompt (no raw text).
_SAFE_SNAPSHOT_KEYS = (
    "overall_score",
    "apply_recommendation",
    "confidence_score",
    "job_search_health",
    "top_3_priority_gaps",
    "weak_topics_to_study",
    "repeated_skill_gaps",
)


def _shape_activity(row: dict[str, Any]) -> dict[str, Any]:
    related_job = row.get("related_job")
    return {
        "id": row.get("id"),
        "activity_type": row.get("activity_type"),
        "title": row.get("title"),
        "assistant_description": row.get("assistant_description"),
        "importance": row.get("importance"),
        "created_at": row.get("created_at"),
        "related_job": related_job if isinstance(related_job, dict) else None,
    }


@router.get("")
def list_activities(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        rows, total = data_client.list_activity_feed(
            user_profile_id=user_profile_id, limit=limit, offset=offset
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Activity data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Activity data is unavailable.") from exc

    return JSONResponse(
        status_code=200,
        content={
            "activities": [_shape_activity(row) for row in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    )


@router.post("/{activity_id}/generate-description")
def regenerate_description(
    activity_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    data_client = _data_client()
    settings = get_settings()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        row = data_client.get_activity(activity_id=activity_id)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Activity data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Activity data is unavailable.") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if str(row.get("user_id")) != str(user_profile_id):
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "unauthorized",
                    "message": "Activity not found or not owned by you.",
                    "retryable": False,
                }
            },
        )

    try:
        snapshot = data_client.get_workflow_run_snapshot(
            run_id=str(row.get("workflow_run_id") or "")
        )
        event_context = _event_context(row, snapshot)

        # Observability: standalone regenerations get their own run row.
        run = data_client.insert_workflow_run(
            user_profile_id=user_profile_id,
            workflow_type="activity_description",
            subject_type="match" if row.get("related_match_id") else "dashboard",
            subject_id=row.get("related_match_id"),
        )
        run_id = str(run["id"])
        now = datetime.now(UTC).isoformat()
        data_client.update_workflow_run(run_id=run_id, status="running", started_at=now)

        helper = ActivityDescriptionHelper(settings=settings)
        description = helper.generate(
            event_context=event_context,
            fallback=fallback_description(
                activity_type=str(row.get("activity_type") or "workflow"),
                title=row.get("title"),
                assistant_description=row.get("assistant_description"),
                importance=str(row.get("importance") or "low"),
            ),
        )

        updated = data_client.update_activity_description(
            activity_id=activity_id,
            user_profile_id=user_profile_id,
            title=description.activity_title,
            assistant_description=description.assistant_description,
            importance=description.importance,
        )
        data_client.update_workflow_run(
            run_id=run_id,
            status="completed",
            completed_at=datetime.now(UTC).isoformat(),
            model_provider=description.provider,
            model_name=description.model_name,
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Activity data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Activity data is unavailable.") from exc

    if not updated:
        raise HTTPException(status_code=404, detail="Activity not found.")
    return JSONResponse(status_code=200, content={"activity": _shape_activity(updated)})


def _event_context(row: dict[str, Any], run: dict[str, Any] | None) -> dict[str, Any]:
    context: dict[str, Any] = {
        "activity_event": {
            "activity_type": row.get("activity_type"),
            "workflow_run_id": row.get("workflow_run_id"),
            "related_job_id": row.get("related_job_id"),
        }
    }
    related_job = row.get("related_job")
    if isinstance(related_job, dict) and related_job:
        context["related_job"] = {
            "title": related_job.get("title"),
            "company": related_job.get("company"),
        }
    snapshot = (run or {}).get("output_snapshot_json") or {}
    if isinstance(snapshot, dict):
        analysis = {
            key: snapshot[key] for key in _SAFE_SNAPSHOT_KEYS if snapshot.get(key) is not None
        }
        if analysis:
            context["related_analysis"] = analysis
    return context
