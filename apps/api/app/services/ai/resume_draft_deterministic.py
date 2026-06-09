"""Deterministic tailored resume draft — the typed fallback for ``resume_draft``.

Python port of ``buildTailoredResumeDraft`` (apps/web/src/lib/resume-draft-generator.mjs,
US-009), projected onto the saved US-031 suggestions. Includes Safe-to-use and
user-accepted suggestions, keeps Needs-confirmation items behind a marker, and
excludes Do-not-use-yet (unsupported) and rejected (not_selected) suggestions. It
invents nothing — the body is the canonical resume text plus supported rewrites.
"""

from __future__ import annotations

import re
from typing import Any

DETERMINISTIC_CONFIDENCE = 0.6


def _clean(value: Any, fallback: str = "") -> str:
    text = str(value if value is not None else fallback).strip()
    return text or fallback


def _bullet(value: str) -> str:
    collapsed = re.sub(r"\s+", " ", _clean(value))
    return f"- {collapsed}"


def build_resume_draft(
    *,
    resume_title: str,
    resume_text: str,
    job_title: str,
    company: str,
    suggestions: list[dict[str, Any]] | None,
) -> dict:
    """Return a Feature 4.4 ``ResumeDraftOutput``-shaped dict (no model call)."""
    rows = [s for s in (suggestions or []) if isinstance(s, dict)]

    def status(row: dict[str, Any]) -> str:
        return row.get("truth_guard_status") or ""

    def action(row: dict[str, Any]) -> str:
        return row.get("user_action") or "pending"

    safe_lines: list[str] = []
    confirm_lines: list[str] = []
    included: list[str] = []
    excluded: list[dict[str, str]] = []

    for row in rows:
        text = _clean(row.get("suggested_text"))
        if not text:
            continue
        if action(row) == "rejected":
            excluded.append({"suggestion": text, "reason": "not_selected"})
            continue
        if status(row) == "Do not use yet":
            excluded.append({"suggestion": text, "reason": "unsupported"})
            continue
        if status(row) == "Safe to use" or action(row) == "accepted":
            safe_lines.append(_bullet(text))
            included.append(text)
        elif status(row) == "Needs confirmation":
            confirm_lines.append(_bullet(f"{text} [Needs confirmation before use]"))
            included.append(text)

    title = f"{_clean(resume_title, 'Resume')} tailored for {_clean(job_title, 'target role')}"
    markdown = "\n".join(
        [
            f"# {title}",
            "",
            f"Target company: {_clean(company, 'Unknown company')}",
            f"Target role: {_clean(job_title, 'Unknown role')}",
            "",
            "## Evidence-backed positioning updates",
            "\n".join(safe_lines)
            if safe_lines
            else "- No suggestions are currently marked Safe to use.",
            "",
            "## Items requiring confirmation",
            "\n".join(confirm_lines)
            if confirm_lines
            else "- No suggestions currently require confirmation.",
            "",
            "## Canonical resume source",
            _clean(resume_text, "No canonical resume text available."),
        ]
    )

    quality_notes: list[str] = []
    if any(item["reason"] == "unsupported" for item in excluded):
        quality_notes.append("Unsupported claims (Do not use yet) were excluded from the draft.")
    if any(item["reason"] == "not_selected" for item in excluded):
        quality_notes.append("Rejected suggestions were excluded.")
    quality_notes.append("Markdown only — review before applying. PDF/DOCX export is post-MVP.")

    summary = (
        f"Tailored {_clean(resume_title, 'your resume')} for "
        f"{_clean(job_title, 'the role')}: included {len(included)} supported "
        f"suggestion(s), excluded {len(excluded)}."
    )

    return {
        "resume_markdown": markdown,
        "tailoring_summary": summary,
        "included_suggestions": included,
        "excluded_suggestions": excluded,
        "quality_notes": quality_notes,
        "confidence_score": DETERMINISTIC_CONFIDENCE,
    }
