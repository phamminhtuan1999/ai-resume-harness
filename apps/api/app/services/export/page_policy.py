"""Deterministic page-count policy for the Draft CV (US-043, Period 10).

The server — not the model — owns how long a resume should be (decision 0014
§1). ``compute_page_policy`` normalizes the Period 10 brief's
years-of-experience bands into a target and a maximum, using only mechanical
signals: the ``user_profiles.years_of_experience`` column first, a
conservative span-parse of profile work-history dates second, and a default
band (target 1, max 2, ``yoe_unknown`` note) when neither exists. Seniority
and the 12+y "exceptional cases" gate use keyword/marker proxies, never the
model's say-so. The model's ``recommended_page_count`` is clamped into the
policy with ``clamp_page_count``; everything else it says about rendering is
display-only rationale.

Pure functions, no I/O; ``now_year`` is injectable so results are
reproducible in tests.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

# Bands (brief §1, normalized in decision 0014 §1 / period README #1).
DEFAULT_TARGET_PAGES = 1
DEFAULT_MAX_PAGES = 2

# Evidence-volume trigger: enough profile material that forcing one page would
# plausibly cut job-relevant content (mechanical proxy for the brief's
# "highly relevant experience / important projects" justification).
EVIDENCE_BULLET_THRESHOLD = 18
EVIDENCE_ENTRY_THRESHOLD = 4

_SENIORITY_KEYWORDS = (
    "senior",
    "staff",
    "lead",
    "principal",
    "manager",
    "head",
    "architect",
)
_EXCEPTIONAL_TITLE_KEYWORDS = ("principal", "staff", "distinguished", "research")
_EXCEPTIONAL_PROFILE_MARKERS = ("publication", "patent")

_YEAR_RE = re.compile(r"\b(19[5-9]\d|20\d{2})\b")
_PRESENT_RE = re.compile(r"\b(present|current|now|today)\b", re.IGNORECASE)


@dataclass(frozen=True)
class PagePolicy:
    """The server-authoritative length contract for one generation."""

    target_pages: int
    max_pages: int
    yoe: float | None
    yoe_source: str  # 'profile' | 'parsed_work_history' | 'unknown'
    basis: str  # human-readable, e.g. "6 years of experience (profile)"
    seniority_signal: str | None
    exceptional: bool
    evidence_volume: int
    notes: tuple[str, ...] = ()

    def allows(self, pages: int) -> bool:
        return 1 <= pages <= self.max_pages

    def as_dict(self) -> dict[str, Any]:
        return {
            "target_pages": self.target_pages,
            "max_pages": self.max_pages,
            "yoe": self.yoe,
            "yoe_source": self.yoe_source,
            "basis": self.basis,
            "seniority_signal": self.seniority_signal,
            "exceptional": self.exceptional,
            "evidence_volume": self.evidence_volume,
            "notes": list(self.notes),
        }


def policy_from_dict(value: Any) -> PagePolicy | None:
    """Rehydrate a stored ``rendering_json.page_policy`` snapshot (export-time
    override validation). Returns None for missing/unusable snapshots."""
    if not isinstance(value, dict):
        return None
    try:
        return PagePolicy(
            target_pages=int(value.get("target_pages") or DEFAULT_TARGET_PAGES),
            max_pages=int(value.get("max_pages") or DEFAULT_MAX_PAGES),
            yoe=value.get("yoe"),
            yoe_source=str(value.get("yoe_source") or "unknown"),
            basis=str(value.get("basis") or ""),
            seniority_signal=value.get("seniority_signal"),
            exceptional=bool(value.get("exceptional")),
            evidence_volume=int(value.get("evidence_volume") or 0),
            notes=tuple(value.get("notes") or ()),
        )
    except (TypeError, ValueError):
        return None


# --- years of experience ----------------------------------------------------------


def _years_in(value: Any) -> list[int]:
    if not value:
        return []
    return [int(y) for y in _YEAR_RE.findall(str(value))]


def _parse_work_history_yoe(
    work_experience: list[dict[str, Any]] | None, now_year: int
) -> float | None:
    """Conservative span estimate from free-form date strings ("Oct 2022",
    "Present", "2019"): max year (or now for present-tense ends) minus min
    year. Months are ignored; overlaps collapse into the one span."""
    years: list[int] = []
    saw_present = False
    for entry in work_experience or []:
        if not isinstance(entry, dict):
            continue
        for key in ("start_date", "end_date"):
            raw = entry.get(key)
            years.extend(_years_in(raw))
            if raw and _PRESENT_RE.search(str(raw)):
                saw_present = True
    if not years:
        return None
    upper = now_year if saw_present else max(years)
    span = upper - min(years)
    return float(max(span, 0))


def resolve_yoe(
    *,
    years_of_experience: float | None,
    candidate_profile: dict[str, Any] | None,
    now_year: int,
) -> tuple[float | None, str]:
    if years_of_experience is not None:
        return float(years_of_experience), "profile"
    profile = candidate_profile or {}
    parsed = _parse_work_history_yoe(profile.get("work_experience"), now_year)
    if parsed is not None:
        return parsed, "parsed_work_history"
    return None, "unknown"


# --- mechanical signals -------------------------------------------------------------


def _evidence_volume(candidate_profile: dict[str, Any] | None) -> tuple[int, int]:
    """(total bullets across work + projects, work entry count)."""
    profile = candidate_profile or {}
    bullets = 0
    entries = 0
    for item in profile.get("work_experience") or []:
        if not isinstance(item, dict):
            continue
        entries += 1
        bullets += len([b for b in item.get("bullet_points") or [] if isinstance(b, str)])
    for item in profile.get("projects") or []:
        if isinstance(item, dict):
            bullets += len([f for f in item.get("key_features") or [] if isinstance(f, str)])
    return bullets, entries


def _candidate_titles(
    candidate_profile: dict[str, Any] | None, current_role: str | None
) -> list[str]:
    titles = [current_role or ""]
    profile = candidate_profile or {}
    basic = profile.get("basic_info") or {}
    titles.append(str(basic.get("current_title") or ""))
    for item in profile.get("work_experience") or []:
        if isinstance(item, dict):
            titles.append(str(item.get("title") or ""))
    return [t for t in titles if t.strip()]


def _seniority_signal(
    *,
    job_title: str | None,
    job_structured: dict[str, Any] | None,
    titles: list[str],
) -> str | None:
    haystacks = [job_title or ""]
    structured = job_structured if isinstance(job_structured, dict) else {}
    for key in ("seniority", "seniority_level", "level"):
        value = structured.get(key)
        if isinstance(value, str):
            haystacks.append(value)
    haystacks.extend(titles)
    blob = " ".join(haystacks).lower()
    for keyword in _SENIORITY_KEYWORDS:
        if keyword in blob:
            return keyword
    return None


def _is_exceptional(
    *,
    candidate_profile: dict[str, Any] | None,
    job_title: str | None,
    titles: list[str],
) -> bool:
    blob = " ".join([job_title or "", *titles]).lower()
    if any(k in blob for k in _EXCEPTIONAL_TITLE_KEYWORDS):
        return True
    profile_blob = str(candidate_profile or {}).lower()
    return any(marker in profile_blob for marker in _EXCEPTIONAL_PROFILE_MARKERS)


# --- the policy ----------------------------------------------------------------------


def compute_page_policy(
    *,
    years_of_experience: float | None,
    candidate_profile: dict[str, Any] | None,
    current_role: str | None = None,
    job_title: str | None = None,
    job_structured: dict[str, Any] | None = None,
    now_year: int | None = None,
) -> PagePolicy:
    year = now_year if now_year is not None else datetime.now(UTC).year
    yoe, yoe_source = resolve_yoe(
        years_of_experience=years_of_experience,
        candidate_profile=candidate_profile,
        now_year=year,
    )
    bullets, entries = _evidence_volume(candidate_profile)
    evidence_trigger = bullets >= EVIDENCE_BULLET_THRESHOLD or entries >= EVIDENCE_ENTRY_THRESHOLD
    titles = _candidate_titles(candidate_profile, current_role)
    seniority = _seniority_signal(
        job_title=job_title, job_structured=job_structured, titles=titles
    )
    exceptional = _is_exceptional(
        candidate_profile=candidate_profile, job_title=job_title, titles=titles
    )

    notes: list[str] = []
    if yoe is None:
        target, max_pages = DEFAULT_TARGET_PAGES, DEFAULT_MAX_PAGES
        basis = "experience level unknown"
        notes.append("yoe_unknown")
        # The gate proxies only widen bands when the band itself is known.
        exceptional = False
    elif yoe < 3:
        target, max_pages = 1, 1
        basis = _basis(yoe, yoe_source)
        exceptional = False
    elif yoe < 8:
        target = 1
        max_pages = 2 if (yoe >= 5 or evidence_trigger) else 1
        basis = _basis(yoe, yoe_source)
        exceptional = False
    elif yoe < 12:
        target = 2 if (seniority or evidence_trigger) else 1
        max_pages = 2
        basis = _basis(yoe, yoe_source)
        exceptional = False
    else:
        target = 2
        max_pages = 3 if exceptional else 2
        basis = _basis(yoe, yoe_source)

    return PagePolicy(
        target_pages=target,
        max_pages=max_pages,
        yoe=yoe,
        yoe_source=yoe_source,
        basis=basis,
        seniority_signal=seniority,
        exceptional=exceptional,
        evidence_volume=bullets,
        notes=tuple(notes),
    )


def _basis(yoe: float, source: str) -> str:
    rounded = int(yoe) if float(yoe).is_integer() else round(yoe, 1)
    suffix = " (estimated from work history)" if source == "parsed_work_history" else ""
    unit = "year" if rounded == 1 else "years"
    return f"{rounded} {unit} of experience{suffix}"


def clamp_page_count(requested: int, policy: PagePolicy) -> tuple[int, bool]:
    """Clamp a model-recommended page count into the policy's allowed range.

    Returns ``(clamped_value, moved)``; ``moved`` drives the ``policy_clamped``
    quality note.
    """
    clamped = max(1, min(int(requested), policy.max_pages))
    return clamped, clamped != int(requested)
