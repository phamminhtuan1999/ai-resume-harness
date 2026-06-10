"""Deterministic Draft CV fallback (US-039).

Used when no Gemini key is configured or the provider fails terminally. It does
**not** paraphrase: it copies the candidate's own structured content verbatim, so
every bullet is ``safe_to_use`` by construction. Output is schema-shaped with
``confidence_score = 0.0`` (the foundation flags the run ``needs_review``). Job
keywords are surfaced only when the candidate's profile already supports them;
the server guards still run on this output and will strip anything unsupported.
"""

from __future__ import annotations

from typing import Any

from app.schemas.draft_cv import BULLET_MAX_CHARS
from app.services.export.page_policy import PagePolicy

# candidate_profile_json.skills key -> display category, in render order.
_SKILL_CATEGORIES: list[tuple[str, str]] = [
    ("programming_languages", "Programming Languages"),
    ("backend", "Backend"),
    ("frontend", "Frontend"),
    ("databases", "Databases"),
    ("cloud_devops", "Cloud & DevOps"),
    ("ai_ml", "AI / ML"),
    ("testing", "Testing / QA"),
    ("tools", "Tools"),
]

_EVIDENCE = "Copied verbatim from your resume."


def _clip(text: str | None) -> str:
    value = (text or "").strip()
    if len(value) <= BULLET_MAX_CHARS:
        return value
    return value[: BULLET_MAX_CHARS - 1].rstrip() + "…"


def _bullet(text: str) -> dict[str, Any]:
    return {
        "text": _clip(text),
        "source_evidence": _EVIDENCE,
        "truth_guard_status": "safe_to_use",
        "keywords_used": [],
    }


def build_draft_cv(
    *,
    candidate_profile: dict[str, Any] | None,
    job_title: str | None,
    company: str | None,
    source_url: str | None,
    job_keywords: list[str],
    page_policy: PagePolicy | None = None,
) -> dict[str, Any]:
    profile = candidate_profile or {}
    basic = profile.get("basic_info") or {}
    summary = profile.get("professional_summary") or {}
    skills = profile.get("skills") or {}

    skill_groups = []
    supported_terms: set[str] = set()
    for key, label in _SKILL_CATEGORIES:
        items = [s for s in (skills.get(key) or []) if isinstance(s, str) and s.strip()]
        if items:
            skill_groups.append({"category": label, "items": items})
            supported_terms.update(s.lower() for s in items)

    prioritized = [kw for kw in job_keywords if kw.lower() in supported_terms]

    work_experience = []
    for item in profile.get("work_experience") or []:
        if not isinstance(item, dict):
            continue
        bullets = [
            _bullet(b)
            for b in (item.get("bullet_points") or [])
            if isinstance(b, str) and b.strip()
        ]
        work_experience.append(
            {
                "company": item.get("company") or "",
                "title": item.get("title") or "",
                "location": item.get("location"),
                "start_date": item.get("start_date"),
                "end_date": item.get("end_date"),
                "bullets": bullets,
            }
        )

    projects = []
    for item in profile.get("projects") or []:
        if not isinstance(item, dict):
            continue
        feature_bullets = [
            _bullet(f)
            for f in (item.get("key_features") or [])
            if isinstance(f, str) and f.strip()
        ]
        projects.append(
            {
                "name": item.get("project_name") or "",
                "description": item.get("description"),
                "tech_stack": [t for t in (item.get("tech_stack") or []) if isinstance(t, str)],
                "bullets": feature_bullets,
                "links": [
                    link for link in (item.get("links") or []) if isinstance(link, str)
                ],
            }
        )

    education = [
        {
            "school": item.get("school") or "",
            "degree": item.get("degree"),
            "field": item.get("field_of_study"),
            "start_date": None,
            "end_date": item.get("dates"),
            "details": item.get("details"),
        }
        for item in profile.get("education") or []
        if isinstance(item, dict)
    ]

    certifications = [
        {
            "name": item.get("name") or "",
            "issuer": item.get("issuer"),
            "date": item.get("date"),
            "credential_url": item.get("credential_url"),
        }
        for item in profile.get("certifications") or []
        if isinstance(item, dict)
    ]

    professional_summary = (
        summary.get("candidate_summary")
        or summary.get("resume_summary")
        or ""
    )

    positioning = summary.get("primary_engineering_background") or ""
    strategy_summary = (
        f"Tailored your existing experience to {job_title or 'the role'}"
        f"{f' at {company}' if company else ''} using only resume-backed content."
    )

    return {
        "candidate": {
            "full_name": basic.get("full_name") or "",
            "email": basic.get("email"),
            "phone": basic.get("phone"),
            "location": basic.get("location"),
            "linkedin_url": basic.get("linkedin_url"),
            "github_url": basic.get("github_url"),
            "portfolio_url": basic.get("portfolio_url"),
        },
        "target_job": {
            "company": company,
            "title": job_title,
            "source_url": source_url,
        },
        "cv_strategy": {
            "summary": strategy_summary,
            "primary_positioning": positioning,
            "keywords_prioritized": prioritized,
            "keywords_excluded": [],
        },
        "professional_summary": _clip(professional_summary) if professional_summary else "",
        "skills": skill_groups,
        "work_experience": work_experience,
        "projects": projects,
        "education": education,
        "certifications": certifications,
        "quality_notes": [],
        "rendering_recommendation": _rendering_recommendation(page_policy),
        "confidence_score": 0.0,
    }


def _rendering_recommendation(policy: PagePolicy | None) -> dict[str, Any]:
    """The fallback never guesses: page count is the policy target with a
    templated reason; fonts/density are the documented defaults (0014 §1)."""
    target = policy.target_pages if policy else 1
    basis = policy.basis if policy else "a standard software-engineering profile"
    return {
        "recommended_page_count": target,
        "page_count_reason": (
            f"Based on {basis}, a {target}-page resume is recommended for this role."
        ),
        "font_profile": "modern_latex",
        "layout_density": "compact" if target == 1 else "standard",
        "compression_strategy": [],
    }
