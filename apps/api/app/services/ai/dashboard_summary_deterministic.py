"""Deterministic dashboard-summary fallback (US-036, §4 fallback table).

Pure aggregation over the same input payload the prompt uses: repeated gaps are
skills appearing in two or more jobs' missing-skill analyses (by frequency),
best-fit roles are job titles scoring >= 65, and the health band comes from the
average match score. ``confidence_score`` is fixed at 0.4 (below the 0.5 bar,
so fallback summaries surface as ``needs_review``).
"""

from __future__ import annotations

from collections import Counter
from typing import Any

FALLBACK_CONFIDENCE = 0.4

_BEST_FIT_SCORE = 65
_STRONG_AVG = 70
_MODERATE_AVG = 50


def repeated_gaps(missing_skills_across_jobs: list[dict[str, Any]]) -> list[str]:
    """Skills appearing in >= 2 jobs' analyses, sorted by frequency desc."""
    counts: Counter[str] = Counter()
    for entry in missing_skills_across_jobs:
        skills = {
            str(s.get("skill")).strip()
            for s in entry.get("missing_skills") or []
            if isinstance(s, dict) and s.get("skill")
        }
        counts.update(skills)
    return [skill for skill, count in counts.most_common() if count >= 2]


def build_dashboard_summary(payload: dict[str, Any]) -> dict[str, Any]:
    """Schema-valid Feature 9.4 summary without a model call."""
    jobs = {str(j.get("id")): j for j in payload.get("jobs") or [] if j.get("id")}
    scores = [
        s
        for s in payload.get("match_scores") or []
        if isinstance(s.get("overall_score"), (int, float))
    ]

    gaps = repeated_gaps(payload.get("missing_skills_across_jobs") or [])

    best_fit: list[str] = []
    for score in scores:
        if score["overall_score"] >= _BEST_FIT_SCORE:
            title = (jobs.get(str(score.get("job_id"))) or {}).get("title")
            if title and title not in best_fit:
                best_fit.append(str(title))

    average = sum(s["overall_score"] for s in scores) / len(scores) if scores else 0
    health = (
        "strong" if average >= _STRONG_AVG else "moderate" if average >= _MODERATE_AVG else "weak"
    )

    top_fit = best_fit[0] if best_fit else "no clear front-runner yet"
    top_gaps = ", ".join(gaps[:3]) if gaps else "none repeating yet"
    return {
        "dashboard_summary": (
            f"Based on {len(jobs)} job(s), your top role fit is {top_fit}. "
            f"Key gaps: {top_gaps}."
        ),
        "best_fit_roles": best_fit,
        "repeated_skill_gaps": gaps,
        "job_search_health": health,
        "recommended_next_actions": [
            f"Build a portfolio project demonstrating {gap}." for gap in gaps[:3]
        ]
        or ["Analyze more saved jobs so patterns can emerge."],
        "confidence_score": FALLBACK_CONFIDENCE,
    }
