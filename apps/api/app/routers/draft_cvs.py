"""Draft CV endpoints (US-039 generation + reads).

Match-scoped generate/regenerate/read run the ``DraftCvWorkflow`` on the US-027
foundation and return the standard envelope; draft-scoped reads return one owned
version. Review (US-040) and export (US-041/US-042) routes are added to this same
router. Every endpoint resolves the Clerk identity to a ``user_profiles.id`` and
enforces ownership; typed ``AIWorkflowError`` failures become ``{ error }``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.auth import AuthenticatedUser, require_authenticated_user
from app.services.ai.draft_cv_logic import derive_draft_status, set_bullet_action
from app.services.ai.draft_cv_workflow import DraftCvWorkflow
from app.services.ai.errors import AIWorkflowError
from app.services.export.fonts import (
    DEFAULT_FONT_PROFILE,
    resolve_font_profile,
    resolve_pdf_fonts,
)
from app.services.export.options import RenderOptions
from app.services.export.page_policy import policy_from_dict
from app.services.export.render_model import (
    build_export_notes,
    build_render_model,
    filename_slug,
    is_empty_cv,
    pending_review_count,
    renderable_bullet_count,
)
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataClient,
    SupabaseDataError,
)
from app.settings import get_settings

# Mounted at /api so this router owns both /api/matches/{id}/draft-cv and
# /api/draft-cvs/{id} (see app/main.py).
router = APIRouter()

_MISCONFIGURED = "Draft CV data source is misconfigured."
_UNAVAILABLE = "Draft CV data is unavailable."


def _data_client() -> SupabaseDataClient:
    try:
        return SupabaseDataClient(get_settings())
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc


def _resolve_profile(data_client: SupabaseDataClient, user: AuthenticatedUser) -> str:
    profile = data_client.get_profile_for_clerk_user(user.clerk_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile["id"]


def _run(match_id: str, request: Request, user: AuthenticatedUser, *, regenerate: bool) -> JSONResponse:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    workflow = DraftCvWorkflow(data_client=data_client, settings=get_settings())
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
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    return JSONResponse(status_code=200, content=result)


@router.post("/matches/{match_id}/draft-cv")
def generate_draft_cv(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run(match_id, request, user, regenerate=False)


@router.post("/matches/{match_id}/draft-cv/regenerate")
def regenerate_draft_cv(
    match_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    return _run(match_id, request, user, regenerate=True)


@router.get("/matches/{match_id}/draft-cv")
def get_latest_draft_cv(
    match_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Latest draft + version list + the latest draft_cv run for the match."""
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        draft = data_client.get_latest_draft_cv(
            match_id=match_id, user_profile_id=user_profile_id
        )
        versions = data_client.list_draft_cv_versions(
            match_id=match_id, user_profile_id=user_profile_id
        )
        run = data_client.get_latest_workflow_run(
            match_id=match_id, user_profile_id=user_profile_id, workflow_type="draft_cv"
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    return JSONResponse(
        status_code=200,
        content={
            "match_id": match_id,
            "draft_cv": draft,
            "versions": versions,
            "workflow_run": run,
        },
    )


@router.get("/draft-cvs/{draft_cv_id}")
def get_draft_cv(
    draft_cv_id: str,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    data_client = _data_client()
    try:
        user_profile_id = _resolve_profile(data_client, user)
        row = data_client.get_draft_cv_by_id(
            draft_cv_id=draft_cv_id, user_profile_id=user_profile_id
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    if not row:
        raise HTTPException(status_code=404, detail="Draft CV not found.")
    return JSONResponse(status_code=200, content={"draft_cv": row})


# --- US-040 review / approval ---------------------------------------------------


class BulletActionPatch(BaseModel):
    user_action: Literal["approved", "rejected", "pending"]


def _owned_draft(data_client: SupabaseDataClient, user: AuthenticatedUser, draft_cv_id: str):
    user_profile_id = _resolve_profile(data_client, user)
    row = data_client.get_draft_cv_by_id(
        draft_cv_id=draft_cv_id, user_profile_id=user_profile_id
    )
    return user_profile_id, row


@router.patch("/draft-cvs/{draft_cv_id}/bullets/{bullet_id}")
def patch_draft_cv_bullet(
    draft_cv_id: str,
    bullet_id: str,
    body: BulletActionPatch,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Approve/reject one ``needs_confirmation`` bullet and recompute the draft's
    derived status. Last-write-wins per bullet."""
    data_client = _data_client()
    try:
        user_profile_id, row = _owned_draft(data_client, user, draft_cv_id)
        if not row:
            raise HTTPException(status_code=404, detail="Draft CV not found.")

        cv_json = row.get("cv_json") or {}
        if not set_bullet_action(cv_json, bullet_id, body.user_action):
            raise HTTPException(status_code=404, detail="Bullet not found.")

        new_status = derive_draft_status(cv_json, row.get("confidence_score"))
        updated = data_client.update_draft_cv(
            draft_cv_id=draft_cv_id,
            user_profile_id=user_profile_id,
            fields={"cv_json": cv_json, "status": new_status},
        )
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    if not updated:
        raise HTTPException(status_code=404, detail="Draft CV not found.")
    return JSONResponse(status_code=200, content={"draft_cv": updated})


# --- US-041 / US-042 export -----------------------------------------------------


@router.get("/draft-cvs/{draft_cv_id}/export-preview")
def export_preview(
    draft_cv_id: str,
    pages: int | None = None,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    """Render-model summary + server-computed export_notes + pending count +
    rendering/compression info, with no file produced. Powers the
    warn-before-export dialog, the recommendation panel, and the override
    control. ``pages`` previews a specific page-count override."""
    data_client = _data_client()
    try:
        _user_profile_id, row = _owned_draft(data_client, user, draft_cv_id)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    if not row:
        raise HTTPException(status_code=404, detail="Draft CV not found.")

    resolved, error = _resolve_render(row, pages)
    if error is not None:
        return JSONResponse(status_code=422, content={"error": error})
    assert resolved is not None

    cv_json = row.get("cv_json") or {}
    render_model = build_render_model(cv_json)
    return JSONResponse(
        status_code=200,
        content={
            "draft_cv_id": draft_cv_id,
            "render_model_summary": {
                "sections": [k for k in render_model if render_model.get(k)],
                "renderable_bullet_count": renderable_bullet_count(render_model),
                "is_empty": is_empty_cv(render_model),
            },
            "export_notes": build_export_notes(row),
            "pending_review_count": pending_review_count(cv_json),
            "rendering": _rendering_block(row, resolved),
        },
    )


@dataclass
class _Resolved:
    options: RenderOptions
    recommended_pages: int | None
    max_pages: int | None
    override_warning: str | None
    has_recommendation: bool


def _resolve_render(row: dict, pages: int | None) -> tuple[_Resolved | None, dict | None]:
    """Build render options from the stored rendering metadata + an optional
    ``pages`` override (US-045). Returns (resolved, None) or (None, error
    envelope) for an invalid override. Legacy rows (no rendering_json) keep
    Period 9 behavior and reject ``pages``."""
    rendering = row.get("rendering_json") or {}
    if not rendering:
        if pages is not None:
            return None, {
                "code": "no_rendering_recommendation",
                "message": "Regenerate this draft to choose a page count.",
                "retryable": False,
            }
        # Legacy: default font, no page targeting, no compression.
        return _Resolved(RenderOptions(), None, None, None, False), None

    recommendation = rendering.get("recommendation") or {}
    policy = policy_from_dict(rendering.get("page_policy"))
    recommended = int(recommendation.get("recommended_page_count") or 1)
    max_pages = policy.max_pages if policy else recommended
    prioritized = tuple(
        (row.get("cv_strategy_json") or {}).get("keywords_prioritized") or []
    )

    target = recommended
    warning: str | None = None
    if pages is not None:
        if not 1 <= pages <= max_pages:
            return None, {
                "code": "invalid_page_override",
                "message": f"Choose a page count between 1 and {max_pages}.",
                "retryable": False,
            }
        target = pages
        if target < recommended:
            warning = (
                f"You chose {target} page(s); ApplyWise recommends {recommended}. "
                "Some lower-priority detail may be compressed to fit."
            )

    options = RenderOptions(
        font_profile=recommendation.get("font_profile") or DEFAULT_FONT_PROFILE,
        page_target=target,
        density=recommendation.get("layout_density") or "standard",
        prioritized_keywords=prioritized,
    )
    return _Resolved(options, recommended, max_pages, warning, True), None


def _rendering_block(row: dict, resolved: _Resolved) -> dict:
    """The export-preview rendering surface: fonts the export will use, whether
    the embedded path is available (a fallback is user-visible before
    download), the recommendation/override state, and — when page-targeted —
    the deterministic compression report (US-045)."""
    profile = resolve_font_profile(resolved.options.font_profile)
    fonts = resolve_pdf_fonts(profile)
    block: dict = {
        "font_profile": profile.key,
        "font_display_name": profile.display_name,
        "font_embedded": fonts.embedded,
        "docx_font": profile.docx_font,
        "has_recommendation": resolved.has_recommendation,
        "recommended_pages": resolved.recommended_pages,
        "max_pages": resolved.max_pages,
        "effective": {
            "page_target": resolved.options.page_target,
            "density": resolved.options.density,
            "font_profile": profile.key,
        },
        "override_warning": resolved.override_warning,
        "compression": None,
    }
    if resolved.options.page_target is not None:
        from app.services.export.pdf_renderer import render_pdf_paged

        try:
            _content, report, _model, _info = render_pdf_paged(
                row.get("cv_json") or {}, resolved.options
            )
            block["compression"] = report
        except RuntimeError:
            block["compression"] = None
    return block


def _export(
    draft_cv_id: str,
    user: AuthenticatedUser,
    *,
    fmt: Literal["pdf", "docx"],
    pages: int | None = None,
) -> Response:
    data_client = _data_client()
    try:
        user_profile_id, row = _owned_draft(data_client, user, draft_cv_id)
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=_MISCONFIGURED) from exc
    except SupabaseDataError as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc

    if not row:
        raise HTTPException(status_code=404, detail="Draft CV not found.")

    resolved, error = _resolve_render(row, pages)
    if error is not None:
        return JSONResponse(status_code=422, content={"error": error})
    assert resolved is not None

    cv_json = row.get("cv_json") or {}
    render_model = build_render_model(cv_json)
    if is_empty_cv(render_model):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "empty_cv",
                    "message": "This CV has no content to export yet. Approve at least one item first.",
                    "retryable": False,
                }
            },
        )

    target_job = cv_json.get("target_job") or {}
    slug = filename_slug(render_model, target_job)
    options = resolved.options

    try:
        if fmt == "pdf":
            stamp_field = "last_exported_pdf_at"
            media_type = "application/pdf"
            if options.page_target is not None:
                from app.services.export.pdf_renderer import render_pdf_paged

                content, _report, _model, _info = render_pdf_paged(cv_json, options)
            else:
                from app.services.export.pdf_renderer import render_pdf

                content = render_pdf(render_model, options)
        else:
            from app.services.export.docx_renderer import render_docx

            media_type = (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            stamp_field = "last_exported_docx_at"
            if options.page_target is not None:
                # Render the identical compressed model the PDF measure loop
                # selected, so DOCX content matches the PDF exactly.
                from app.services.export.pdf_renderer import render_pdf_paged

                _pdf, _report, compressed_model, _info = render_pdf_paged(cv_json, options)
                content = render_docx(compressed_model, options)
            else:
                content = render_docx(render_model, options)
    except RuntimeError:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "render_failure",
                    "message": "We could not render the document. Please try again.",
                    "retryable": True,
                }
            },
        )

    _stamp_export(data_client, user_profile_id, draft_cv_id, row, stamp_field, cv_json)

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{slug}.{fmt}"'},
    )


def _stamp_export(
    data_client: SupabaseDataClient,
    user_profile_id: str,
    draft_cv_id: str,
    row: dict,
    stamp_field: str,
    cv_json: dict,
) -> None:
    """Record the export: timestamp + status 'exported' + a draft_cv.exported
    activity event. Best-effort; a stamp failure must not fail the download."""
    from datetime import UTC, datetime

    try:
        data_client.update_draft_cv(
            draft_cv_id=draft_cv_id,
            user_profile_id=user_profile_id,
            fields={stamp_field: datetime.now(UTC).isoformat(), "status": "exported"},
        )
        data_client.insert_activity(
            user_profile_id=user_profile_id,
            workflow_run_id=None,
            activity_type="draft_cv.exported",
            title="ApplyWise exported your draft CV.",
            importance="medium",
            related_job_id=str(row["job_id"]) if row.get("job_id") else None,
            related_match_id=str(row["match_id"]) if row.get("match_id") else None,
            assistant_description=None,
        )
    except (SupabaseConfigurationError, SupabaseDataError):
        # The user already has their file; observability is best-effort here.
        pass


@router.post("/draft-cvs/{draft_cv_id}/export/pdf")
def export_pdf(
    draft_cv_id: str,
    pages: int | None = None,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> Response:
    return _export(draft_cv_id, user, fmt="pdf", pages=pages)


@router.post("/draft-cvs/{draft_cv_id}/export/docx")
def export_docx(
    draft_cv_id: str,
    pages: int | None = None,
    user: AuthenticatedUser = Depends(require_authenticated_user),
) -> Response:
    return _export(draft_cv_id, user, fmt="docx", pages=pages)
