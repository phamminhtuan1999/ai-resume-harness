"""Analysis package composition + decision recompute (US-047, Period 11).

Two operations over the same source bundle:

* :func:`get_analysis_package` — a **pure read** (0015 §7). It composes saved
  module rows, serves the latest decision snapshot's verdict (recomputing only
  the volatile presentation), computes a staleness flag, and never writes.
* :func:`recompute_decision` — the **only writer** of ``analysis_decisions``.
  It runs the engine, dedupes via ``inputs_hash``, records the previous label,
  and writes an activity entry on a genuine label transition.

Composition is read-only with a bounded query count (≤ 10 PostgREST round trips
on the full fixture — asserted in the US-047 tests).
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from app.schemas.analysis_package import (
    AnalysisDecisionHistory,
    AnalysisDetails,
    AnalysisPackage,
    AnalysisStep,
    ApplicationRef,
    ConfidenceModel,
    DecisionHistoryEntry,
    DecisionHistoryInputs,
    DecisionModel,
    Evidence,
    EvidenceMatched,
    JobSummary,
    MaterialReadinessModel,
    NextActionModel,
    PreviousDecision,
    ResumeRef,
    ScoreBreakdown,
    SkillGap,
)
from app.services.decision_adapters import build_decision_inputs
from app.services.decision_engine import (
    DISPLAY_LABELS,
    RULES_VERSION,
    DecisionInputs,
    build_presentation,
    decide,
    qualitative_confidence,
)

_CORE_RUN_TYPES = ("match_analysis", "missing_skills", "assistant_insight")


# --- Source loading (the bounded read set) --------------------------------------


def _load_sources(data_client: Any, *, user_profile_id: str, match_id: str) -> dict[str, Any] | None:
    """Load every row the package composes. Returns ``None`` if the match is not
    owned (router maps that to 404)."""
    bundle = data_client.get_match_with_resume_and_job(
        match_id=match_id, user_profile_id=user_profile_id
    )
    if not bundle or not bundle.get("match"):
        return None

    return {
        "match": bundle.get("match") or {},
        "resume": bundle.get("resume") or {},
        "job": bundle.get("job") or {},
        "missing": data_client.get_missing_skill_analysis(
            match_id=match_id, user_profile_id=user_profile_id
        ),
        "insight": data_client.get_assistant_insight(
            match_id=match_id, user_profile_id=user_profile_id
        ),
        "suggestions": data_client.get_resume_suggestions_for_match(
            match_id=match_id, user_profile_id=user_profile_id
        ),
        "profile": data_client.get_candidate_profile(user_profile_id=user_profile_id),
        "application": data_client.get_application_for_match(
            match_id=match_id, user_profile_id=user_profile_id
        ),
        "latest_runs": data_client.get_latest_runs_for_match(
            match_id=match_id, user_profile_id=user_profile_id
        ),
    }


def _run_completed(latest_runs: list[dict[str, Any]] | None, workflow_type: str) -> bool:
    return any(
        r.get("workflow_type") == workflow_type and r.get("status") == "completed"
        for r in (latest_runs or [])
    )


def _build_inputs(sources: dict[str, Any]) -> DecisionInputs:
    runs = sources.get("latest_runs") or []
    return build_decision_inputs(
        match_row=sources["match"],
        missing_skills_row=sources.get("missing"),
        insight_row=sources.get("insight"),
        suggestion_rows=sources.get("suggestions"),
        profile=sources.get("profile"),
        job=sources.get("job"),
        application=sources.get("application"),
        latest_runs=runs,
        has_roadmap=_run_completed(runs, "roadmap"),
        has_draft_cv=_run_completed(runs, "draft_cv"),
    )


# --- Hashing + staleness --------------------------------------------------------


def _compute_inputs_hash(sources: dict[str, Any]) -> str:
    """Stable identity of the inputs that produced a decision (0015 §7):
    module row ids + their ``updated_at`` + the rules version."""
    match = sources["match"]
    parts = [f"match:{match.get('id')}:{match.get('updated_at')}:{match.get('analyzed_at')}"]
    for key in ("missing", "insight", "profile", "resume", "job"):
        row = sources.get(key) or {}
        parts.append(f"{key}:{row.get('id')}:{row.get('updated_at')}")
    suggestions = sources.get("suggestions") or []
    parts.append(
        "suggestions:"
        + ",".join(sorted(f"{s.get('id')}:{s.get('updated_at')}" for s in suggestions))
    )
    application = sources.get("application") or {}
    parts.append(f"application:{application.get('status')}:{application.get('applied_date')}")
    parts.append(f"rules:{RULES_VERSION}")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def _parse_ts(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_stale(decided_at: Any, sources: dict[str, Any]) -> bool:
    """Stale when any decision input is newer than the snapshot: resume/job
    ``updated_at`` and ``user_profiles.updated_at`` (0015 §10)."""
    base = _parse_ts(decided_at)
    if base is None:
        return False
    for key in ("resume", "job", "profile"):
        ts = _parse_ts((sources.get(key) or {}).get("updated_at"))
        if ts is not None and ts > base:
            return True
    return False


# --- Evidence / gaps projections ------------------------------------------------


def _evidence_from_sources(sources: dict[str, Any], inputs: DecisionInputs) -> dict[str, Any]:
    match = sources["match"]
    matched = []
    for item in match.get("top_strengths_json") or []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("strength") or "").strip()
        if not label:
            continue
        matched.append(
            {"label": label, "detail": str(item.get("why_it_matters") or item.get("resume_evidence") or "")}
        )
    missing = [g.skill for g in inputs.gaps if g.skill]
    risks = [str(r) for r in (match.get("risks_json") or []) if isinstance(r, str)]
    return {"matched": matched, "missing": missing, "risks": risks}


def _evidence_model(payload: dict[str, Any] | None) -> Evidence:
    payload = payload or {}
    return Evidence(
        matched=[EvidenceMatched(**m) for m in payload.get("matched", []) if isinstance(m, dict)],
        missing=[str(s) for s in payload.get("missing", [])],
        risks=[str(r) for r in payload.get("risks", [])],
    )


def _skill_gaps(sources: dict[str, Any]) -> list[SkillGap]:
    row = sources.get("missing") or {}
    gaps = []
    for item in row.get("missing_skills_json") or []:
        if not isinstance(item, dict):
            continue
        gaps.append(
            SkillGap(
                skill=str(item.get("skill") or ""),
                importance=str(item.get("importance") or "medium"),
                gap_type=str(item.get("gap_type") or "true_gap"),
                evidence_status=str(item.get("evidence_status") or "no_evidence"),
                why_it_matters=str(item.get("why_it_matters") or ""),
                how_to_fix=str(item.get("how_to_fix") or ""),
                interview_risk=str(item.get("interview_risk") or ""),
            )
        )
    return gaps


def _scores_from(scores_json: dict[str, Any] | None, inputs: DecisionInputs) -> ScoreBreakdown:
    scores_json = scores_json or {}
    return ScoreBreakdown(
        overall=int(scores_json.get("overall", inputs.overall_score) or 0),
        skill=int(scores_json.get("skill", inputs.sub_scores.get("skill", 0)) or 0),
        experience=int(scores_json.get("experience", inputs.sub_scores.get("experience", 0)) or 0),
        ai_readiness=int(scores_json.get("ai_readiness", inputs.sub_scores.get("ai_readiness", 0)) or 0),
        ats_keywords=int(scores_json.get("ats_keywords", inputs.sub_scores.get("ats_keywords", 0)) or 0),
        seniority=int(scores_json.get("seniority", inputs.sub_scores.get("seniority", 0)) or 0),
    )


def _analysis_details(latest_runs: list[dict[str, Any]] | None) -> AnalysisDetails:
    runs = latest_runs or []
    steps = [
        AnalysisStep(
            workflow_type=str(r.get("workflow_type") or ""),
            status=str(r.get("status") or ""),
            model_provider=r.get("model_provider"),
            model_name=r.get("model_name"),
            completed_at=r.get("completed_at"),
        )
        for r in runs
        if r.get("workflow_type")
    ]
    # Lead with the core match-analysis run's provider when available.
    lead = next((r for r in runs if r.get("workflow_type") == "match_analysis"), runs[0] if runs else {})
    completed = [r.get("completed_at") for r in runs if r.get("completed_at")]
    return AnalysisDetails(
        model_provider=lead.get("model_provider"),
        model_name=lead.get("model_name"),
        last_run_at=max(completed) if completed else None,
        steps=steps,
    )


# --- Public read path -----------------------------------------------------------


def get_analysis_package(
    data_client: Any, *, user_profile_id: str, match_id: str
) -> tuple[AnalysisPackage, str | None] | None:
    """Compose the package for a match. Pure read — never writes a snapshot.

    Returns ``(package, etag)`` or ``None`` when the match is not owned.
    """
    sources = _load_sources(data_client, user_profile_id=user_profile_id, match_id=match_id)
    if sources is None:
        return None

    match = sources["match"]
    job, resume, application = sources["job"], sources["resume"], sources["application"]
    inputs = _build_inputs(sources)

    job_summary = JobSummary(
        id=job.get("id"),
        title=job.get("title") or "",
        company=job.get("company") or "",
        location=job.get("location"),
        work_type=job.get("work_type"),
        job_url=job.get("job_url"),
    )
    resume_ref = ResumeRef(id=resume.get("id"), title=resume.get("title"))
    application_ref = (
        ApplicationRef(status=application.get("status"), applied_date=application.get("applied_date"))
        if application
        else None
    )
    details = _analysis_details(sources.get("latest_runs"))

    has_analysis = bool(match.get("apply_recommendation"))
    if not has_analysis:
        package = AnalysisPackage(
            rules_version=RULES_VERSION,
            analysis_state="not_analyzed",
            stale=False,
            analyzed_at=match.get("analyzed_at"),
            job=job_summary,
            resume=resume_ref,
            application=application_ref,
            decision=None,
            scores=ScoreBreakdown(),
            evidence=Evidence(),
            skill_gaps=[],
            next_actions=[],
            material_readiness=None,
            analysis_details=details,
        )
        return package, None

    snapshot = data_client.get_latest_decision_snapshot(
        match_id=match_id, user_profile_id=user_profile_id
    )

    if snapshot:
        label = snapshot["label"]
        confidence = ConfidenceModel(
            score=snapshot.get("confidence"),
            reasons=list(snapshot.get("confidence_reasons_json") or []),
            qualitative=qualitative_confidence(
                snapshot.get("confidence"), tuple(snapshot.get("confidence_reasons_json") or [])
            ),
        )
        previous = None
        prev_label = snapshot.get("previous_label")
        if prev_label and prev_label != label:
            previous = PreviousDecision(label=prev_label, decided_at=snapshot.get("decided_at"))
        decision = DecisionModel(
            label=label,
            display_label=snapshot.get("display_label") or DISPLAY_LABELS[label],
            match_score=int(snapshot.get("match_score") or inputs.overall_score),
            risk_level=snapshot.get("risk_level") or "medium",
            summary=snapshot.get("summary") or "",
            confidence=confidence,
            previous=previous,
        )
        scores = _scores_from(snapshot.get("scores_json"), inputs)
        evidence = _evidence_model(snapshot.get("evidence_json"))
        decided_at = snapshot.get("decided_at")
        etag = snapshot.get("inputs_hash")
        stale = _is_stale(decided_at, sources)
    else:
        # Analyzed but never recomputed (e.g. pre-Period-11 match): compute a
        # transient verdict for display. Still a pure read — nothing persisted.
        result = decide(inputs)
        label = result.label
        decision = DecisionModel(
            label=label,
            display_label=result.display_label,
            match_score=result.match_score,
            risk_level=result.risk_level,
            summary=result.summary,
            confidence=ConfidenceModel(
                score=result.confidence.score,
                reasons=list(result.confidence.reasons),
                qualitative=result.confidence.qualitative,
            ),
            previous=None,
        )
        scores = _scores_from(None, inputs)
        evidence = _evidence_model(_evidence_from_sources(sources, inputs))
        etag = _compute_inputs_hash(sources)
        stale = False

    readiness, actions = build_presentation(inputs, label)
    state = "stale" if stale else ("partial" if inputs.missing_modules else "complete")

    package = AnalysisPackage(
        rules_version=RULES_VERSION,
        analysis_state=state,
        stale=stale,
        analyzed_at=match.get("analyzed_at"),
        job=job_summary,
        resume=resume_ref,
        application=application_ref,
        decision=decision,
        scores=scores,
        evidence=evidence,
        skill_gaps=_skill_gaps(sources),
        next_actions=[
            NextActionModel(
                type=a.type,
                label=a.label,
                priority=a.priority,
                reason=a.reason,
                placement=a.placement,
                state=a.state,
            )
            for a in actions
        ],
        material_readiness=MaterialReadinessModel(
            draft_cv=readiness.draft_cv,
            cover_letter=readiness.cover_letter,
            reason=readiness.reason,
        ),
        analysis_details=details,
    )
    return package, etag


# --- Public write path (the only snapshot writer) -------------------------------


def recompute_decision(data_client: Any, *, user_profile_id: str, match_id: str) -> dict[str, Any] | None:
    """Compute and persist one decision snapshot (0015 §7).

    Dedupes via ``inputs_hash`` (no duplicate snapshot for identical inputs),
    records ``previous_label``, and writes one ``analysis_decision.changed``
    activity entry on a genuine label transition. Returns the snapshot row, the
    deduped existing row, or ``None`` when there is nothing to decide (match not
    owned, or not analyzed yet).
    """
    sources = _load_sources(data_client, user_profile_id=user_profile_id, match_id=match_id)
    if sources is None:
        return None
    match = sources["match"]
    if not match.get("apply_recommendation"):
        return None

    inputs = _build_inputs(sources)
    result = decide(inputs)
    inputs_hash = _compute_inputs_hash(sources)

    latest = data_client.get_latest_decision_snapshot(
        match_id=match_id, user_profile_id=user_profile_id
    )
    if latest and latest.get("inputs_hash") == inputs_hash:
        return latest  # identical inputs → no new snapshot

    previous_label = latest.get("label") if latest else None
    snapshot_payload = {
        "label": result.label,
        "display_label": result.display_label,
        "match_score": result.match_score,
        "scores_json": {"overall": inputs.overall_score, **inputs.sub_scores},
        "risk_level": result.risk_level,
        "confidence": result.confidence.score,
        "confidence_reasons_json": list(result.confidence.reasons),
        "summary": result.summary,
        "evidence_json": _evidence_from_sources(sources, inputs),
        "inputs_snapshot_json": _inputs_snapshot(sources),
        "inputs_hash": inputs_hash,
        "rules_version": RULES_VERSION,
        "previous_label": previous_label,
    }
    inserted = data_client.insert_decision_snapshot(
        user_profile_id=user_profile_id, match_id=match_id, snapshot=snapshot_payload
    )

    # Activity only on a genuine transition between two labels (design
    # Observability: the feed stays meaningful).
    if previous_label is not None and previous_label != result.label:
        job = sources.get("job") or {}
        data_client.insert_activity(
            user_profile_id=user_profile_id,
            workflow_run_id=None,
            activity_type="analysis_decision.changed",
            title=f"Recommendation changed to {result.display_label}",
            importance="medium",
            related_job_id=job.get("id"),
            related_match_id=match_id,
            assistant_description=result.summary,
        )
    return inserted


def _history_entry(row: dict[str, Any]) -> DecisionHistoryEntry:
    """Map a stored snapshot row to a history entry, summarizing input freshness
    from the snapshot's timestamps (never raw row ids — US-054)."""
    snapshot = row.get("inputs_snapshot_json") or {}

    def updated_at(key: str) -> str | None:
        stamp = snapshot.get(key) or {}
        return stamp.get("updated_at") if isinstance(stamp, dict) else None

    label = row.get("label")
    return DecisionHistoryEntry(
        id=row.get("id"),
        label=label,
        display_label=row.get("display_label") or DISPLAY_LABELS.get(label, ""),
        match_score=row.get("match_score"),
        risk_level=row.get("risk_level"),
        confidence=row.get("confidence"),
        summary=row.get("summary") or "",
        previous_label=row.get("previous_label"),
        rules_version=row.get("rules_version") or "",
        decided_at=row.get("decided_at"),
        inputs=DecisionHistoryInputs(
            resume_updated_at=updated_at("resume"),
            job_updated_at=updated_at("job"),
            profile_updated_at=updated_at("profile"),
        ),
    )


def build_decision_history(
    data_client: Any, *, user_profile_id: str, match_id: str, limit: int = 20
) -> AnalysisDecisionHistory | None:
    """Read-only decision history for a match (US-054).

    Returns ``None`` when the match isn't owned (router maps that to 404), so an
    unowned match is denied rather than served an empty list. Entries are
    newest-first and capped at ``limit``; ``dropped`` reports how many older runs
    were left off so a truncated list never reads as the whole story.
    """
    bundle = data_client.get_match_with_resume_and_job(
        match_id=match_id, user_profile_id=user_profile_id
    )
    if not bundle or not bundle.get("match"):
        return None

    rows, total = data_client.get_decision_history(
        match_id=match_id, user_profile_id=user_profile_id, limit=limit
    )
    entries = [_history_entry(row) for row in rows]
    return AnalysisDecisionHistory(
        match_id=match_id,
        returned=len(entries),
        total=total,
        dropped=max(0, total - len(entries)),
        entries=entries,
    )


def _inputs_snapshot(sources: dict[str, Any]) -> dict[str, Any]:
    """Human-readable record of which module rows fed the decision (US-054)."""

    def stamp(row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        return {"id": row.get("id"), "updated_at": row.get("updated_at")}

    return {
        "match": {"id": sources["match"].get("id"), "analyzed_at": sources["match"].get("analyzed_at")},
        "resume": stamp(sources.get("resume")),
        "job": stamp(sources.get("job")),
        "profile": stamp(sources.get("profile")),
        "missing_skills": stamp(sources.get("missing")),
        "assistant_insight": stamp(sources.get("insight")),
        "suggestions_count": len(sources.get("suggestions") or []),
    }


__all__ = ["get_analysis_package", "recompute_decision", "build_decision_history"]
