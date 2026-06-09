"""Deterministic roadmap fallback (US-034).

Python port of ``buildFourWeekRoadmap`` from
``apps/web/src/lib/roadmap-generator.mjs`` (US-010), upgraded to the Feature 6.4
output schema. Sorts the US-029 missing-skill gaps by importance so critical
gaps land in weeks 1-2, assigns one gap per week, and pads surplus weeks with
the same four practical AI-engineering fallback skills the JS baseline used.
``confidence_score`` is fixed at 0.5 (below the 0.7 bar, so fallback roadmaps
surface as ``needs_review``).
"""

from __future__ import annotations

from typing import Any

FALLBACK_CONFIDENCE = 0.5

_IMPORTANCE_RANK = {"critical": 0, "medium": 1, "nice_to_have": 2}
_FALLBACK_SKILLS = (
    "LLM API integration",
    "evaluation",
    "deployment",
    "resume evidence and interview narrative",
)


def _sorted_gap_skills(missing_skills: list[dict[str, Any]]) -> list[str]:
    gaps = [g for g in missing_skills if isinstance(g, dict) and g.get("skill")]
    gaps.sort(key=lambda g: _IMPORTANCE_RANK.get(str(g.get("importance")), 1))
    return [str(g["skill"]).strip() for g in gaps]


def _make_week(index: int, focus: str, target_role: str, company: str) -> dict[str, Any]:
    article = "an" if target_role[:1].lower() in "aeiou" else "a"
    return {
        "week": index + 1,
        "goal": f"Build credible {focus} evidence for {target_role}.",
        "skills_covered": [focus],
        "tasks": [
            f"Study production patterns and failure modes for {focus}.",
            f"Implement a small, testable example that demonstrates {focus}.",
            f"Write notes on tradeoffs, limitations, and where this applies to {company}.",
        ],
        "deliverables": [
            f"Working {focus} demo or documented project increment.",
            "README section explaining design choices and verification.",
        ],
        "project_feature": (
            f"Extend the portfolio project with {focus} and a clear before/after result."
        ),
        "resume_bullet_after_completion": (
            f"After completing the work, add a truthful bullet about building {focus} "
            f"capability for {article} {target_role} use case."
        ),
        "interview_talking_point": (
            f"Walk through how you designed, implemented, and verified the {focus} "
            "work, including the tradeoffs you considered."
        ),
    }


def build_roadmap(
    *,
    missing_skills: list[dict[str, Any]],
    target_role: str,
    company: str,
) -> dict[str, Any]:
    """Schema-valid Feature 6.4 roadmap without a model call."""
    role = (target_role or "AI Engineer").strip() or "AI Engineer"
    org = (company or "the target company").strip() or "the target company"

    gap_skills = _sorted_gap_skills(missing_skills)
    focuses = [
        gap_skills[index] if index < len(gap_skills) else _FALLBACK_SKILLS[index]
        for index in range(4)
    ]
    weeks = [_make_week(index, focus, role, org) for index, focus in enumerate(focuses)]

    top_focus = ", ".join(focuses[:3])
    return {
        "roadmap_summary": (
            f"This 4-week baseline roadmap targets your highest-priority gaps for the "
            f"{role} role at {org}: {top_focus}. Each week produces a concrete, "
            "portfolio-ready deliverable you can reference honestly in interviews."
        ),
        "recommended_project_theme": (
            f"Extend one portfolio project into a small {role} showcase for {org}, "
            "adding one verified capability each week."
        ),
        "weeks": weeks,
        "success_criteria": [
            "A working, documented project increment exists for each of the 4 weeks.",
            "Each deliverable is demoable and explained in the project README.",
            "Four future-use resume bullets are drafted, ready to add after honest completion.",
        ],
        "confidence_score": FALLBACK_CONFIDENCE,
    }
