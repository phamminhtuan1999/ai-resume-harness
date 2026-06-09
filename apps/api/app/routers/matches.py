"""Match AI workflow endpoints (US-027 reference + US-028 match analyzer).

All endpoints resolve the Clerk identity to a ``user_profiles.id`` and run the
match analysis on the US-027 ``BaseAIWorkflow``. Success returns the standard
envelope; typed ``AIWorkflowError`` failures return ``{ error: {...} }`` with the
mapped HTTP status. The run row + an activity event are written even on failure
(handled inside the workflow); the router only translates errors to responses.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.ai_workflow import (
    MatchWorkflowRunsResponse,
    WorkflowRunSummary,
)
from app.services.ai.assistant_insight_workflow import AssistantInsightWorkflow
from app.services.ai.base_workflow import BaseAIWorkflow
from app.services.ai.cover_letter_workflow import CoverLetterWorkflow
from app.services.ai.errors import AIWorkflowError
from app.services.ai.match_analysis_workflow import MatchAnalysisWorkflow
from app.services.ai.missing_skills_workflow import MissingSkillsWorkflow
from app.services.ai.resume_draft_workflow import ResumeDraftWorkflow
from app.services.ai.resume_suggestions_workflow import ResumeSuggestionsWorkflow
from app.services.ai.roadmap_workflow import RoadmapWorkflow
from app.services.ai.run_full_orchestrator import (
    STEP_WORKFLOWS,
    RunFullOrchestrator,
)
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.settings import get_settings

router = APIRouter()


def _resolve_profile(data_client: SupabaseDataClient, user: AuthenticatedUser) -> str:
    profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile["id"]


def _data_client() -> SupabaseDataClient:
    try:
        return SupabaseDataClient(get_settings())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc


def _run_match_workflow(
    workflow_cls: type[BaseAIWorkflow],
    *,
    match_id: str,
    request: Request,
    user: AuthenticatedUser,
    regenerate: bool,
) -> JSONResponse:
    """Run any match-scoped AI workflow on the US-027 foundation and translate the
    standard envelope / typed errors into an HTTP response."""
    settings = get_settings()
    data_client = _data_client()

    try:
        user_profile_id = _resolve_profile(data_client, user)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    workflow = workflow_cls(data_client=data_client, settings=settings)
    try:
        result = workflow.run(
            subject_id=match_id,
            user_profile_id=user_profile_id,
            regenerate=regenerate,
            request_id=request.headers.get("x-request-id"),
        )
    except AIWorkflowError as exc:
        return JSONResponse(status_code=exc.http_status, content=exc.to_envelope())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    return JSONResponse(status_code=200, content=result)


def _get_saved(match_id: str, user: AuthenticatedUser, reader: str, not_found: str) -> JSONResponse:
    """Read a saved per-match AI result via a named ``SupabaseDataClient`` method."""
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        row = getattr(data_client, reader)(match_id=match_id, user_profile_id=user_profile_id)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    if not row:
        raise HTTPException(status_code=404, detail=not_found)
    return JSONResponse(status_code=200, content={"match_id": match_id, "result": row})


@router.post("/{match_id}/analyze")
def analyze_match(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        MatchAnalysisWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/analyze/regenerate")
def regenerate_match(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        MatchAnalysisWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


# --- US-029 Missing skill analysis ----------------------------------------------


@router.post("/{match_id}/missing-skills")
def missing_skills(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        MissingSkillsWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/missing-skills/regenerate")
def regenerate_missing_skills(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        MissingSkillsWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/missing-skills")
def get_missing_skills(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _get_saved(
        match_id, user, "get_missing_skill_analysis", "Missing skill analysis not found."
    )


# --- US-030 Job assistant insight -----------------------------------------------


@router.post("/{match_id}/assistant-insight")
def assistant_insight(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        AssistantInsightWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/assistant-insight/regenerate")
def regenerate_assistant_insight(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        AssistantInsightWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/assistant-insight")
def get_assistant_insight(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _get_saved(
        match_id, user, "get_assistant_insight", "Assistant insight not found."
    )


# --- US-031 Resume suggestions --------------------------------------------------


@router.post("/{match_id}/resume-suggestions")
def resume_suggestions(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        ResumeSuggestionsWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/resume-suggestions/regenerate")
def regenerate_resume_suggestions(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        ResumeSuggestionsWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/resume-suggestions")
def get_resume_suggestions(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Return saved suggestion rows plus the latest run's strategy/keywords snapshot."""
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        suggestions = data_client.get_resume_suggestions_for_match(
            match_id=match_id, user_profile_id=user_profile_id
        )
        run = data_client.get_latest_workflow_run(
            match_id=match_id,
            user_profile_id=user_profile_id,
            workflow_type="resume_suggestions",
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    snapshot = (run or {}).get("output_snapshot_json") or {}
    return JSONResponse(
        status_code=200,
        content={
            "match_id": match_id,
            "workflow_run": run,
            "suggestions": suggestions,
            "resume_strategy": snapshot.get("resume_strategy"),
            "assistant_summary": snapshot.get("assistant_summary"),
            "keywords_to_include": snapshot.get("keywords_to_include") or [],
            "do_not_claim": snapshot.get("do_not_claim") or [],
        },
    )


# --- US-032 Tailored resume draft -----------------------------------------------


@router.post("/{match_id}/tailored-resume")
def tailored_resume(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        ResumeDraftWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/tailored-resume/regenerate")
def regenerate_tailored_resume(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        ResumeDraftWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/tailored-resume")
def get_tailored_resume(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _get_saved(
        match_id, user, "get_latest_resume_version", "Resume draft not found."
    )


# --- US-033 Cover letter --------------------------------------------------------


@router.post("/{match_id}/cover-letter")
def cover_letter(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        CoverLetterWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/cover-letter/regenerate")
def regenerate_cover_letter(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        CoverLetterWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/cover-letter")
def get_cover_letter(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _get_saved(match_id, user, "get_cover_letter", "Cover letter not found.")


# --- US-034 Roadmap ---------------------------------------------------------------


@router.post("/{match_id}/roadmap")
def roadmap(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        RoadmapWorkflow, match_id=match_id, request=request, user=user, regenerate=False
    )


@router.post("/{match_id}/roadmap/regenerate")
def regenerate_roadmap(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run_match_workflow(
        RoadmapWorkflow, match_id=match_id, request=request, user=user, regenerate=True
    )


@router.get("/{match_id}/roadmap")
def get_roadmap(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Return the persisted roadmap plus the latest run metadata (no re-generation)."""
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        row = data_client.get_roadmap_for_match(
            match_id=match_id, user_profile_id=user_profile_id
        )
        run = data_client.get_latest_workflow_run(
            match_id=match_id, user_profile_id=user_profile_id, workflow_type="roadmap"
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Roadmap not found.")

    roadmap_json = row.get("roadmap_json") or {}
    return JSONResponse(
        status_code=200,
        content={
            "match_id": match_id,
            "workflow_run": run,
            "result": {
                "roadmap_id": row.get("id"),
                "title": row.get("title"),
                **(roadmap_json if isinstance(roadmap_json, dict) else {}),
                "saved_at": row.get("updated_at"),
            },
        },
    )


@router.get("/{match_id}/match-analysis")
def get_match_analysis(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        row = data_client.get_saved_match_analysis(
            match_id=match_id, user_profile_id=user_profile_id
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Match analysis not found.")
    if row.get("apply_recommendation") is None:
        raise HTTPException(status_code=404, detail="This match has not been analyzed yet.")

    return JSONResponse(status_code=200, content={"match_id": match_id, "result": row})


@router.get("/{match_id}/ai-workflow", response_model=MatchWorkflowRunsResponse)
def get_match_ai_workflow(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> MatchWorkflowRunsResponse:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        runs = data_client.get_latest_runs_for_match(
            match_id=match_id, user_profile_id=user_profile_id
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    return MatchWorkflowRunsResponse(
        match_id=match_id,
        runs=[
            WorkflowRunSummary(
                workflow_type=run["workflow_type"],
                status=run["status"],
                model_provider=run.get("model_provider"),
                model_name=run.get("model_name"),
                confidence_score=run.get("confidence_score"),
                completed_at=run.get("completed_at"),
                output_snapshot_json=run.get("output_snapshot_json"),
                error_code=run.get("error_code"),
                error_message=run.get("error_message"),
            )
            for run in runs
        ],
    )


# --- US-038 AI workflow panel orchestration ----------------------------------------


@router.post("/{match_id}/ai-workflow/run-full")
def run_full_ai_workflow(
    match_id: str,
    request: Request,
    body: dict | None = None,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Sequentially run every panel step in dependency order (US-038)."""
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    orchestrator = RunFullOrchestrator(data_client=data_client, settings=get_settings())
    try:
        result = orchestrator.run(
            match_id=match_id,
            user_profile_id=user_profile_id,
            force=bool((body or {}).get("force")),
            request_id=request.headers.get("x-request-id"),
        )
    except AIWorkflowError as exc:
        return JSONResponse(status_code=exc.http_status, content=exc.to_envelope())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail="Match data source is misconfigured.") from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail="Match data is unavailable.") from exc

    return JSONResponse(status_code=200, content=result)


@router.post("/{match_id}/ai-workflow/{step}/regenerate")
def regenerate_ai_workflow_step(
    match_id: str,
    step: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Re-run one panel step; ``step`` is its ``workflow_type`` string."""
    workflow_cls = STEP_WORKFLOWS.get(step)
    if workflow_cls is None:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "unknown_step",
                    "message": "That AI workflow step is not recognized.",
                    "retryable": False,
                }
            },
        )
    return _run_match_workflow(
        workflow_cls, match_id=match_id, request=request, user=user, regenerate=True
    )
