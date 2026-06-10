"""Shared Draft CV render model + export gating (US-041).

``build_render_model`` is the ONLY path from a stored ``cv_json`` to anything a
user sees — the web preview, the PDF (US-041), and the DOCX (US-042) all consume
its output. Centralizing the truth-guard filter here makes it the single security
boundary: a bullet renders **iff** it is ``safe_to_use`` or an approved
``needs_confirmation``; ``do_not_use_yet`` and pending/rejected bullets — and
their existence — are absent from the result. Section order is fixed; empty
sections and skill categories are dropped (no "None" placeholders).

The model is plain dicts so the same shape can be JSON-returned to the web
preview and fed to both renderers, guaranteeing preview == PDF == DOCX.
"""

from __future__ import annotations

import re
from typing import Any

# Section order is part of the "ApplyWise standard resume template v1" contract.
SECTION_ORDER = (
    "contact",
    "professional_summary",
    "skills",
    "work_experience",
    "projects",
    "education",
    "certifications",
)


def is_renderable(bullet: dict[str, Any]) -> bool:
    """The single gating predicate, reused everywhere export content is decided."""
    status = bullet.get("truth_guard_status")
    if status == "safe_to_use":
        return True
    if status == "needs_confirmation":
        return bullet.get("user_action") == "approved"
    return False


def _renderable_texts(bullets: list[dict[str, Any]] | None) -> list[str]:
    return [
        (b.get("text") or "").strip()
        for b in (bullets or [])
        if is_renderable(b) and (b.get("text") or "").strip()
    ]


def build_render_model(cv_json: dict[str, Any]) -> dict[str, Any]:
    """Project a stored ``cv_json`` into the filtered, ordered render model."""
    candidate = cv_json.get("candidate") or {}
    contact = {
        "full_name": (candidate.get("full_name") or "").strip(),
        "email": candidate.get("email"),
        "phone": candidate.get("phone"),
        "location": candidate.get("location"),
        "linkedin_url": candidate.get("linkedin_url"),
        "github_url": candidate.get("github_url"),
        "portfolio_url": candidate.get("portfolio_url"),
    }

    skills = [
        {"category": (g.get("category") or "").strip(), "items": list(g.get("items") or [])}
        for g in (cv_json.get("skills") or [])
        if (g.get("items") or [])
    ]

    work_experience = []
    for entry in cv_json.get("work_experience") or []:
        work_experience.append(
            {
                "company": (entry.get("company") or "").strip(),
                "title": (entry.get("title") or "").strip(),
                "location": entry.get("location"),
                "start_date": entry.get("start_date"),
                "end_date": entry.get("end_date"),
                "bullets": _renderable_texts(entry.get("bullets")),
            }
        )

    projects = []
    for entry in cv_json.get("projects") or []:
        projects.append(
            {
                "name": (entry.get("name") or "").strip(),
                "description": entry.get("description"),
                "tech_stack": list(entry.get("tech_stack") or []),
                "bullets": _renderable_texts(entry.get("bullets")),
                "links": list(entry.get("links") or []),
            }
        )

    education = [
        {
            "school": (e.get("school") or "").strip(),
            "degree": e.get("degree"),
            "field": e.get("field"),
            "start_date": e.get("start_date"),
            "end_date": e.get("end_date"),
            "details": e.get("details"),
        }
        for e in cv_json.get("education") or []
    ]

    certifications = [
        {
            "name": (c.get("name") or "").strip(),
            "issuer": c.get("issuer"),
            "date": c.get("date"),
            "credential_url": c.get("credential_url"),
        }
        for c in cv_json.get("certifications") or []
    ]

    return {
        "contact": contact,
        "professional_summary": (cv_json.get("professional_summary") or "").strip(),
        "skills": skills,
        "work_experience": work_experience,
        "projects": projects,
        "education": education,
        "certifications": certifications,
    }


def renderable_bullet_count(render_model: dict[str, Any]) -> int:
    return sum(
        len(entry.get("bullets") or [])
        for section in ("work_experience", "projects")
        for entry in render_model.get(section) or []
    )


def is_empty_cv(render_model: dict[str, Any]) -> bool:
    """No renderable bullets and no professional summary -> nothing to export."""
    return (
        renderable_bullet_count(render_model) == 0
        and not render_model.get("professional_summary")
    )


def pending_review_count(cv_json: dict[str, Any]) -> int:
    """needs_confirmation bullets still awaiting a decision (drives the warn dialog)."""
    count = 0
    for section in ("work_experience", "projects"):
        for entry in cv_json.get(section) or []:
            for bullet in entry.get("bullets") or []:
                if (
                    bullet.get("truth_guard_status") == "needs_confirmation"
                    and bullet.get("user_action", "pending") == "pending"
                ):
                    count += 1
    return count


def build_export_notes(draft_row: dict[str, Any]) -> dict[str, Any]:
    """Server-computed export_notes (never model-authored): which keywords were
    included/excluded, which bullets still need review, and which metrics survived."""
    cv_json = draft_row.get("cv_json") or {}
    strategy = draft_row.get("cv_strategy_json") or {}
    render_model = build_render_model(cv_json)

    rendered_keywords: set[str] = set()
    for section in ("work_experience", "projects"):
        for entry in cv_json.get(section) or []:
            for bullet in entry.get("bullets") or []:
                if is_renderable(bullet):
                    rendered_keywords.update(bullet.get("keywords_used") or [])
    prioritized = set(strategy.get("keywords_prioritized") or [])

    needs_review = [
        (b.get("text") or "")
        for section in ("work_experience", "projects")
        for entry in cv_json.get(section) or []
        for b in (entry.get("bullets") or [])
        if b.get("truth_guard_status") == "needs_confirmation"
        and b.get("user_action", "pending") == "pending"
    ]

    rendered_text = " ".join(
        t
        for section in ("work_experience", "projects")
        for entry in render_model.get(section) or []
        for t in entry.get("bullets") or []
    )
    metrics_preserved = sorted(_impact_tokens(rendered_text))

    return {
        "included_supported_keywords": sorted(rendered_keywords & prioritized) or sorted(rendered_keywords),
        "excluded_unsupported_keywords": [
            e.get("keyword") for e in strategy.get("keywords_excluded") or []
        ],
        "needs_user_review": needs_review,
        "metrics_preserved": metrics_preserved,
    }


_IMPACT_RE = re.compile(r"\$?\d[\d,]*\.?\d*%?")


def _impact_tokens(text: str) -> set[str]:
    return {t for t in _IMPACT_RE.findall(text) if "%" in t or "$" in t}


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def filename_slug(render_model: dict[str, Any], target_job: dict[str, Any] | None = None) -> str:
    """ASCII-safe download filename stem: name + company + title. Never raw user
    data in a header beyond this normalized slug."""
    parts = [render_model.get("contact", {}).get("full_name") or "resume"]
    job = target_job or {}
    if job.get("company"):
        parts.append(job["company"])
    if job.get("title"):
        parts.append(job["title"])
    ascii_text = (
        " ".join(parts)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    slug = _SLUG_RE.sub("-", ascii_text).strip("-")
    return slug or "resume"
