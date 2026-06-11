"""Per-module input adapters for the decision engine (US-047, Period 11).

These pure functions normalize the *saved* outputs of the Period 8 modules into
the engine's :class:`DecisionInputs`. They are the contract boundary 0015
(Consequences) calls out: module stories may not change saved-output shapes
without updating the adapters/fixtures here. The known drift this layer absorbs
is ``truth_guard_status`` casing — Title-Case in ``resume_suggestions`` vs
snake_case in ``draft_cvs.cv_json``.

Absent inputs are the common case (a fresh analysis has no suggestions/insight
row); the defaults below are the contract (0015 §2), not error states.
"""

from __future__ import annotations

from typing import Any

from app.services.decision_engine import DecisionInputs, GapInput

CORE_MODULES = ("match_analysis", "missing_skills", "assistant_insight")

_JOB_DESCRIPTION_MIN_CHARS = 200

# Title-Case (resume_suggestions) and snake_case (draft_cvs.cv_json) both map to
# the canonical snake_case the engine reasons about.
_TRUTH_GUARD_CANON: dict[str, str] = {
    "safe to use": "safe_to_use",
    "needs confirmation": "needs_confirmation",
    "do not use yet": "do_not_use_yet",
    "safe_to_use": "safe_to_use",
    "needs_confirmation": "needs_confirmation",
    "do_not_use_yet": "do_not_use_yet",
}


def normalize_truth_guard(value: Any) -> str:
    """Canonicalize a truth-guard status across both casings; default cautious."""
    return _TRUTH_GUARD_CANON.get(str(value or "").strip().lower(), "needs_confirmation")


def derive_tailoring_signal(suggestion_rows: list[dict[str, Any]] | None) -> str:
    """Tri-state tailoring signal (0015 §2).

    ``unknown`` until suggestions exist (only known ``unsafe`` blocks a label).
    ``unsafe`` only when *every* suggestion is "do not use yet" — i.e. there is
    no safe way to tailor without unsupported claims; otherwise ``safe``.
    """
    rows = suggestion_rows or []
    if not rows:
        return "unknown"
    statuses = [normalize_truth_guard(r.get("truth_guard_status")) for r in rows]
    if statuses and all(s == "do_not_use_yet" for s in statuses):
        return "unsafe"
    return "safe"


def parse_gaps(missing_skills_json: Any) -> tuple[GapInput, ...]:
    """Map ``missing_skills_json`` elements into engine :class:`GapInput` values."""
    if not isinstance(missing_skills_json, list):
        return ()
    gaps: list[GapInput] = []
    for item in missing_skills_json:
        if not isinstance(item, dict):
            continue
        gaps.append(
            GapInput(
                skill=str(item.get("skill", "")).strip(),
                importance=str(item.get("importance", "medium")),
                gap_type=str(item.get("gap_type", "true_gap")),
                evidence_status=str(item.get("evidence_status", "no_evidence")),
            )
        )
    return tuple(gaps)


def _profile_incomplete(profile: dict[str, Any] | None) -> bool:
    profile = profile or {}
    has_role = bool((profile.get("target_role") or "").strip()) or bool(
        (profile.get("current_role") or "").strip()
    )
    has_background = bool((profile.get("technical_background") or "").strip())
    return not (has_role and has_background)


def _confidence_value(row: dict[str, Any] | None) -> float | None:
    if not row:
        return None
    value = row.get("confidence_score")
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _has_requirements(structured_json: Any) -> bool:
    if not isinstance(structured_json, dict):
        return False
    for key in ("requirements", "required_skills", "must_have", "responsibilities", "skills"):
        value = structured_json.get(key)
        if isinstance(value, (list, str)) and value:
            return True
    return False


def _provider_is_deterministic(*rows: dict[str, Any] | None) -> bool:
    for row in rows:
        if not row:
            continue
        provider = row.get("analyzer_provider") or row.get("provider")
        if provider == "deterministic":
            return True
    return False


def _failed_and_partial(
    latest_runs: list[dict[str, Any]] | None,
    *,
    missing_skills_row: dict[str, Any] | None,
    insight_row: dict[str, Any] | None,
) -> tuple[tuple[str, ...], bool, bool]:
    """Return ``(failed_modules, used_deterministic_fallback, module_output_partial)``."""
    runs = latest_runs or []
    failed: list[str] = []
    deterministic = False
    for run in runs:
        wf = run.get("workflow_type")
        if wf not in CORE_MODULES:
            continue
        if run.get("status") == "failed":
            failed.append(wf)
        if run.get("model_provider") == "deterministic":
            deterministic = True

    partial = False
    if missing_skills_row is not None:
        gaps = missing_skills_row.get("missing_skills_json")
        if not gaps and not (missing_skills_row.get("summary") or "").strip():
            partial = True
    if insight_row is not None and not (insight_row.get("recommendation") or "").strip():
        partial = True

    return tuple(failed), deterministic, partial


def build_decision_inputs(
    *,
    match_row: dict[str, Any] | None,
    missing_skills_row: dict[str, Any] | None,
    insight_row: dict[str, Any] | None,
    suggestion_rows: list[dict[str, Any]] | None,
    profile: dict[str, Any] | None,
    job: dict[str, Any] | None,
    application: dict[str, Any] | None,
    latest_runs: list[dict[str, Any]] | None = None,
    has_roadmap: bool = False,
    has_draft_cv: bool = False,
) -> DecisionInputs:
    """Compose normalized engine inputs from saved module rows (no I/O)."""
    match_row = match_row or {}
    profile = profile or {}
    job = job or {}

    overall = int(match_row.get("overall_score") or 0)
    sub_scores = {
        "skill": int(match_row.get("skill_score") or 0),
        "experience": int(match_row.get("experience_score") or 0),
        "ai_readiness": int(match_row.get("ai_readiness_score") or 0),
        "ats_keywords": int(match_row.get("ats_keyword_score") or 0),
        "seniority": int(match_row.get("seniority_score") or 0),
    }

    gaps = parse_gaps((missing_skills_row or {}).get("missing_skills_json"))
    risk_level = (insight_row or {}).get("risk_level") or "medium"
    tailoring = derive_tailoring_signal(suggestion_rows)
    application_status = (application or {}).get("status")

    failed, deterministic, partial = _failed_and_partial(
        latest_runs, missing_skills_row=missing_skills_row, insight_row=insight_row
    )

    missing_modules = []
    if not match_row.get("apply_recommendation"):
        missing_modules.append("match_analysis")
    if missing_skills_row is None:
        missing_modules.append("missing_skills")
    if insight_row is None:
        missing_modules.append("assistant_insight")

    raw_description = str(job.get("raw_description") or "")
    parse_status = job.get("parse_status") or "not_parsed"

    return DecisionInputs(
        overall_score=overall,
        sub_scores=sub_scores,
        gaps=gaps,
        risk_level=risk_level,
        tailoring_signal=tailoring,
        # Dormant until US-052 adds the learning_target status; the engine's
        # user-asserted-relevance fixture exercises this signal directly.
        user_asserted_relevance=application_status == "learning_target",
        target_role=str(profile.get("target_role") or ""),
        current_role=str(profile.get("current_role") or ""),
        technical_background=str(profile.get("technical_background") or ""),
        job_title=str(job.get("title") or ""),
        job_url=job.get("job_url"),
        application_status=application_status,
        has_roadmap=has_roadmap,
        has_draft_cv=has_draft_cv,
        has_suggestions=bool(suggestion_rows),
        match_confidence=_confidence_value(match_row if match_row.get("apply_recommendation") else None),
        missing_skills_confidence=_confidence_value(missing_skills_row),
        insight_confidence=_confidence_value(insight_row),
        profile_incomplete=_profile_incomplete(profile),
        job_description_short=len(raw_description.strip()) < _JOB_DESCRIPTION_MIN_CHARS,
        job_not_extracted=parse_status != "parsed",
        requirements_ambiguous=parse_status == "parsed" and not _has_requirements(job.get("structured_json")),
        module_output_partial=partial,
        used_deterministic_fallback=deterministic or _provider_is_deterministic(match_row),
        failed_modules=failed,
        missing_modules=tuple(missing_modules),
    )


__all__ = [
    "CORE_MODULES",
    "normalize_truth_guard",
    "derive_tailoring_signal",
    "parse_gaps",
    "build_decision_inputs",
]
