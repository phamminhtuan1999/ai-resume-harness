"""Refresh Analysis orchestration (US-050, Period 11).

One user action re-runs only the decision core chain — match analysis → missing
skills → assistant insight → decision recompute — never the four downstream
artifacts (resume draft, draft CV, cover letter, roadmap, interview prep). Job
requirement extraction is re-run conditionally before the chain. The work runs
in the background (the endpoint returns 202); this module is the unit underneath.

See docs/decisions/0015-job-analysis-decision-engine.md §6 and
docs/stories/period-11/US-050-refresh-analysis.md.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.analysis_package import recompute_decision
from app.services.ai.run_full_orchestrator import (
    CORE_MANIFEST,
    CORE_STEP_TYPES,
    RunFullOrchestrator,
)
from app.services.job_extractor import (
    JobExtractionError,
    extract_job_from_markdown,
)

# A second refresh while these are queued/running is rejected with 409.
_IN_PROGRESS_STATUSES = ("queued", "running")


def core_chain_running(data_client: Any, *, match_id: str, user_profile_id: str) -> bool:
    """True when a core-chain run is already queued/running for the match —
    the server-side guard behind the 409 (not UI-only, decision 0015 §6)."""
    runs = data_client.get_latest_runs_for_match(
        match_id=match_id, user_profile_id=user_profile_id
    )
    return any(
        run.get("workflow_type") in CORE_STEP_TYPES
        and run.get("status") in _IN_PROGRESS_STATUSES
        for run in (runs or [])
    )


def should_extract_job(job: dict[str, Any] | None) -> bool:
    """Re-run requirement extraction only when the job needs it.

    Signal (US-050 boundary): extract when the job has a description but no
    successful structured extraction yet. A precise "edited since last
    extraction" trigger would need an ``extracted_at`` column on ``jobs``; that
    is out of scope for Period 11, so a not-yet-extracted job is the trigger.
    """
    if not job:
        return False
    if not str(job.get("raw_description") or "").strip():
        return False
    already_extracted = job.get("extraction_status") == "succeeded" and bool(
        job.get("extraction_json")
    )
    return not already_extracted


def _maybe_extract_job(data_client: Any, settings: Any, *, job: dict[str, Any]) -> None:
    """Best-effort, non-fatal job re-extraction. The core chain runs off the raw
    description regardless, so an extraction failure (e.g. AI unavailable) must
    not abort the refresh."""
    if not should_extract_job(job):
        return
    try:
        extraction = extract_job_from_markdown(
            markdown=str(job.get("raw_description") or ""), settings=settings
        )
    except JobExtractionError:
        return  # AI unavailable / invalid output — proceed on the raw description.

    data_client.update_job_extraction(
        job_id=str(job.get("id")),
        user_profile_id=str(job.get("user_id") or job.get("user_profile_id") or ""),
        fields={
            "extraction_status": "succeeded",
            "extraction_confidence": extraction.confidence_score,
            "extraction_json": extraction.model_dump(mode="json"),
            "parse_status": "parsed",
        },
    )


def run_refresh(
    data_client: Any,
    settings: Any,
    *,
    user_profile_id: str,
    match_id: str,
    request_id: str | None = None,
    marker_run_id: str | None = None,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Execute one refresh: conditional extraction → core chain → recompute.

    On any core-step failure, the decision is **not** recomputed — no snapshot is
    written and the prior package stands (decision 0015 §6). The failed run row
    is recorded by the orchestrator. ``marker_run_id`` is the in-flight guard run
    inserted by the endpoint; it is finalized here so it never lingers as queued.
    Returns the orchestrator result for logging.
    """
    bundle = data_client.get_match_with_resume_and_job(
        match_id=match_id, user_profile_id=user_profile_id
    )
    if not bundle or not bundle.get("match"):
        _finalize_marker(data_client, marker_run_id, succeeded=False)
        return {"status": "unauthorized", "match_id": match_id}

    job = bundle.get("job")
    if job and not job.get("user_id"):
        job = {**job, "user_id": user_profile_id}
    _maybe_extract_job(data_client, settings, job=job or {})

    orchestrator = RunFullOrchestrator(
        data_client=data_client,
        settings=settings,
        manifest=CORE_MANIFEST,
        flip_prepared=False,
    )
    result = orchestrator.run(
        match_id=match_id,
        user_profile_id=user_profile_id,
        force=True,
        # Unchanged inputs reuse the prior result (cheap repeat refresh);
        # "Analyze again anyway" sets force_refresh to bypass reuse end-to-end.
        force_refresh=force_refresh,
        request_id=request_id,
    )

    succeeded = result.get("steps_failed", 0) == 0 and result.get("steps_blocked", 0) == 0
    # Exactly-one-recompute, at the end, only when the whole core chain landed —
    # history never records a decision from mixed/failed generation inputs.
    if succeeded:
        recompute_decision(data_client, user_profile_id=user_profile_id, match_id=match_id)
    result["decision_recomputed"] = succeeded
    _finalize_marker(data_client, marker_run_id, succeeded=succeeded)
    return result


def _finalize_marker(data_client: Any, marker_run_id: str | None, *, succeeded: bool) -> None:
    if not marker_run_id:
        return
    data_client.update_workflow_run(
        run_id=marker_run_id,
        status="completed" if succeeded else "failed",
        completed_at=datetime.now(UTC).isoformat(),
    )


__all__ = [
    "core_chain_running",
    "should_extract_job",
    "run_refresh",
]
