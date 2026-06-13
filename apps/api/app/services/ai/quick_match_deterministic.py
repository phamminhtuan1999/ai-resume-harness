"""Deterministic pre-score for the AI quick match (US-068).

A faithful Python port of ``apps/web/src/lib/job-prescore.mjs``: the same four
signals, the same weights, the same tier thresholds. It serves two roles here:

1. The quick-match workflow's ``deterministic_fallback`` — so when the model is
   unavailable (no key, rate limit, quota), the preview still renders from saved
   data instead of failing.
2. A grounding hint inside the prompt, so the model refines a real local
   estimate rather than guessing cold.

Keep this in lockstep with the ``.mjs`` scorer: both implement the one signal
contract documented in ``docs/decisions/0023-quick-match-prescore-signals.md``.
Pure and dependency-free; no model call, no I/O.
"""

from __future__ import annotations

import re
from typing import Any

# Weights and thresholds: identical to job-prescore.mjs.
_WEIGHTS = {"skills": 0.4, "title": 0.25, "seniority": 0.2, "location": 0.15}
_STRONG_AT = 70
_PROMISING_AT = 45

_STOP_WORDS = {
    "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "at",
    "senior", "junior", "staff", "lead", "principal", "mid", "i", "ii", "iii",
    "engineer", "developer", "remote", "hybrid", "onsite",
}


def _normalize(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.lower()
    text = re.sub(r"[^\w+#./ -]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _tokens(value: Any) -> set[str]:
    return {
        word
        for word in _normalize(value).split(" ")
        if len(word) > 1 and word not in _STOP_WORDS
    }


def _clamp(value: float) -> int:
    return max(0, min(100, round(value)))


def _as_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item or "").strip()]


def job_structured_signals(job: dict[str, Any] | None) -> dict[str, Any]:
    """Merge a job's rich (``extraction_json``) and thin (``structured_json``)
    payloads into the structured fields the pre-score needs. Precedence mirrors
    job-structured-view / the ``.mjs`` scorer: extraction > structured > row."""
    job = job or {}
    rich = job.get("extraction_json") if isinstance(job.get("extraction_json"), dict) else {}
    thin = job.get("structured_json") if isinstance(job.get("structured_json"), dict) else {}

    required_skills = _as_list(rich.get("required_skills")) or _as_list(thin.get("required_skills"))
    work_type = _normalize(rich.get("work_type") or job.get("work_type"))
    location = str(rich.get("location") or job.get("location") or "").strip()
    seniority = _normalize(thin.get("seniority") or rich.get("seniority"))
    years_raw = rich.get("required_experience_years")
    if years_raw is None:
        years_raw = thin.get("years_required")
    try:
        years = float(years_raw) if years_raw is not None else None
    except (TypeError, ValueError):
        years = None

    return {
        "title": str(job.get("title") or "").strip(),
        "required_skills": required_skills,
        "work_type": work_type if work_type and work_type != "unknown" else "",
        "location": location,
        "seniority": seniority if seniority and seniority != "unknown" else "",
        "years_required": years if (years is not None and years > 0) else None,
    }


def _has_structured_data(signals: dict[str, Any]) -> bool:
    return bool(
        signals["required_skills"]
        or signals["work_type"]
        or signals["seniority"]
        or signals["years_required"]
    )


# --- individual signals (each returns 0..100) ----------------------------------


def title_alignment(job_title: str, profile: dict[str, Any]) -> int:
    target = _tokens(f"{profile.get('target_role') or ''} {profile.get('current_role') or ''}")
    title = _tokens(job_title)
    if not target or not title:
        return 55  # no target role to compare — neutral, never a penalty
    overlap = len([word for word in title if word in target])
    return _clamp((overlap / len(title)) * 100)


def skill_overlap(required_skills: list[str], profile: dict[str, Any]) -> int:
    if not required_skills:
        return 60  # structured but skill-less job — mild neutral
    have = _tokens(profile.get("technical_background") or "")
    if not have:
        return 35  # we know the job's skills but nothing about the candidate's
    matched = 0
    for skill in required_skills:
        skill_tokens = _tokens(skill)
        if skill_tokens and all(word in have for word in skill_tokens):
            matched += 1
    return _clamp((matched / len(required_skills)) * 100)


def location_fit(signals: dict[str, Any], profile: dict[str, Any]) -> int:
    if signals["work_type"] == "remote":
        return 100 if _normalize(profile.get("location_preference")) == "remote" else 85
    pref = _normalize(profile.get("location_preference"))
    if pref == "remote" and signals["work_type"] and signals["work_type"] != "remote":
        return 40  # wants remote, job is on-site/hybrid
    if not signals["location"]:
        return 65  # no location data — neutral
    here = _tokens(f"{profile.get('location_city') or ''} {profile.get('location_country') or ''}")
    there = _tokens(signals["location"])
    if not here or not there:
        return 60
    return 90 if any(word in here for word in there) else 50


def seniority_fit(signals: dict[str, Any], profile: dict[str, Any]) -> int:
    years_raw = profile.get("years_of_experience")
    try:
        years = float(years_raw) if years_raw is not None else None
    except (TypeError, ValueError):
        years = None
    required = signals["years_required"]
    if required and years is not None:
        if years >= required:
            return 90
        gap = required - years
        return _clamp(90 - gap * 18)  # each year short is a penalty
    if signals["seniority"] and years is None:
        return 55  # job states a level, we don't know the candidate's
    return 70  # not enough to judge — neutral


# --- composite -----------------------------------------------------------------


def compute_pre_score(*, profile: dict[str, Any] | None, job: dict[str, Any] | None) -> dict[str, Any]:
    """Return ``{tier, score, has_structured, signals}`` for a job/profile pair.

    ``tier`` is one of ``insufficient | weak | promising | strong``; ``score`` is
    ``None`` when there is not enough structured data to estimate (never a fake
    number). Matches computeJobPreScore in job-prescore.mjs exactly."""
    profile = profile or {}
    signals = job_structured_signals(job)
    if not _has_structured_data(signals):
        return {"tier": "insufficient", "score": None, "has_structured": False, "signals": {}}

    title = title_alignment(signals["title"], profile)
    skills = skill_overlap(signals["required_skills"], profile)
    location = location_fit(signals, profile)
    seniority = seniority_fit(signals, profile)

    score = _clamp(
        skills * _WEIGHTS["skills"]
        + title * _WEIGHTS["title"]
        + seniority * _WEIGHTS["seniority"]
        + location * _WEIGHTS["location"]
    )
    tier = "strong" if score >= _STRONG_AT else "promising" if score >= _PROMISING_AT else "weak"
    return {
        "tier": tier,
        "score": score,
        "has_structured": True,
        "signals": {
            "skills": skills,
            "title": title,
            "seniority": seniority,
            "location": location,
        },
    }


# Deterministic confidence per tier. Modest on purpose: a local estimate is less
# certain than the model's, and "insufficient" data should fall below the
# foundation's 0.5 needs-review line so a thin job is flagged, not asserted.
_TIER_CONFIDENCE = {"strong": 0.6, "promising": 0.55, "weak": 0.5, "insufficient": 0.3}

_SIGNAL_PHRASE = {
    "skills": ("your skills line up well with the listed requirements", "the required skills don't clearly match your background"),
    "title": ("the role matches your target title", "the role title is off from what you're targeting"),
    "seniority": ("your experience level fits", "the seniority bar looks like a stretch"),
    "location": ("the location and remote setup work for you", "the location or remote setup may not fit"),
}


def _headline(tier: str, signals: dict[str, int]) -> str:
    if not signals:
        return "There isn't enough detail saved on this job to estimate fit — run the full analysis for a real read."
    strongest = max(signals, key=lambda key: signals[key])
    weakest = min(signals, key=lambda key: signals[key])
    if tier == "strong":
        return f"Likely worth a closer look — {_SIGNAL_PHRASE[strongest][0]}."
    if tier == "promising":
        return f"Could be a fit, but {_SIGNAL_PHRASE[weakest][1]}."
    return f"Probably a long shot — {_SIGNAL_PHRASE[weakest][1]}."


def select_auto_quick_match_jobs(
    prescored_jobs: list[dict[str, Any]], *, limit: int
) -> list[dict[str, Any]]:
    """Bound an automatic batch quick-match to the top ``limit`` jobs (US-068).

    The manual per-job action is never capped — the user asked for that one. This
    is the server-side enforcement point for any *automatic* batch preview: given
    jobs each carrying a ``pre_score`` (``None`` allowed for "insufficient"), it
    returns at most ``AI_QUICK_MATCH_LIMIT`` of them, strongest pre-score first.
    A ``limit`` of 0 disables auto quick match entirely. Jobs that can't be
    pre-scored sort last and are dropped first when the cap bites."""
    if limit <= 0:
        return []
    ranked = sorted(
        prescored_jobs,
        key=lambda job: job.get("pre_score") if job.get("pre_score") is not None else -1,
        reverse=True,
    )
    return ranked[:limit]


def deterministic_quick_match(*, profile: dict[str, Any] | None, job: dict[str, Any] | None) -> dict[str, Any]:
    """Schema-shaped quick-match output (likelihood/headline/confidence) with no
    model call — the workflow's typed fallback. ``insufficient`` collapses to the
    ``weak`` bucket with low confidence and an honest headline."""
    pre = compute_pre_score(profile=profile, job=job)
    tier = pre["tier"]
    likelihood = "weak" if tier == "insufficient" else tier
    return {
        "likelihood": likelihood,
        "headline": _headline(tier, pre["signals"]),
        "confidence_score": _TIER_CONFIDENCE.get(tier, 0.5),
    }
