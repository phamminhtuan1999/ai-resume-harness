"""Markdown renderer for the Draft CV (US-059, decision 0019).

Renders the same shared render model as the PDF (US-041) and DOCX (US-042) into
a plain Markdown document, replacing the retired Markdown resume draft feature:
Markdown is now just a third export format of the single Tailored CV. Because
the input is ``build_render_model`` output, the truth-guard gating is identical
by construction — a bullet appears here iff it appears in the PDF.

Markdown has no pagination, so this renderer never applies page-target
compression; it always emits the full gated model.
"""

from __future__ import annotations

from typing import Any


def render_markdown(render_model: dict[str, Any]) -> str:
    lines: list[str] = []

    contact = render_model.get("contact") or {}
    name = (contact.get("full_name") or "").strip()
    if name:
        lines += [f"# {name}", ""]
    contact_line = " | ".join(
        str(b)
        for b in (
            contact.get("email"),
            contact.get("phone"),
            contact.get("location"),
            contact.get("linkedin_url"),
            contact.get("github_url"),
            contact.get("portfolio_url"),
        )
        if b
    )
    if contact_line:
        lines += [contact_line, ""]

    summary = (render_model.get("professional_summary") or "").strip()
    if summary:
        lines += ["## Professional Summary", "", summary, ""]

    skills = [g for g in (render_model.get("skills") or []) if g.get("items")]
    if skills:
        lines += ["## Skills", ""]
        for group in skills:
            items = ", ".join(group.get("items") or [])
            lines.append(f"- **{group.get('category') or 'Skills'}:** {items}")
        lines.append("")

    _experience_section(lines, render_model.get("work_experience") or [])
    _projects_section(lines, render_model.get("projects") or [])
    _education_section(lines, render_model.get("education") or [])
    _certifications_section(lines, render_model.get("certifications") or [])

    return "\n".join(lines).strip() + "\n"


def _entry_heading(lines: list[str], primary: str, secondary: str, dates: str) -> None:
    title = primary if not secondary else f"{primary} — {secondary}"
    if dates:
        title = f"{title} ({dates})"
    lines += [f"### {title}", ""]


def _bullets(lines: list[str], bullets: list[str]) -> None:
    emitted = False
    for text in bullets:
        if text.strip():
            lines.append(f"- {text}")
            emitted = True
    if emitted:
        lines.append("")


def _experience_section(lines: list[str], entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if (e.get("company") or e.get("title") or e.get("bullets"))]
    if not visible:
        return
    lines += ["## Work Experience", ""]
    for entry in visible:
        _entry_heading(
            lines,
            entry.get("title") or "",
            entry.get("company") or "",
            _date_range(entry.get("start_date"), entry.get("end_date")),
        )
        if entry.get("location"):
            lines += [str(entry["location"]), ""]
        _bullets(lines, entry.get("bullets") or [])


def _projects_section(lines: list[str], entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if (e.get("name") or e.get("bullets"))]
    if not visible:
        return
    lines += ["## Projects", ""]
    for entry in visible:
        _entry_heading(lines, entry.get("name") or "", ", ".join(entry.get("tech_stack") or []), "")
        if entry.get("description"):
            lines += [str(entry["description"]), ""]
        _bullets(lines, entry.get("bullets") or [])


def _education_section(lines: list[str], entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if e.get("school")]
    if not visible:
        return
    lines += ["## Education", ""]
    for entry in visible:
        line = ", ".join(b for b in (entry.get("degree"), entry.get("field")) if b)
        _entry_heading(
            lines,
            entry.get("school") or "",
            line,
            _date_range(entry.get("start_date"), entry.get("end_date")),
        )
        if entry.get("details"):
            lines += [str(entry["details"]), ""]


def _certifications_section(lines: list[str], entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if e.get("name")]
    if not visible:
        return
    lines += ["## Certifications", ""]
    for entry in visible:
        line = " — ".join(
            str(b) for b in (entry.get("name"), entry.get("issuer"), entry.get("date")) if b
        )
        lines.append(f"- {line}")
    lines.append("")


def _date_range(start: Any, end: Any) -> str:
    start = str(start).strip() if start else ""
    end = str(end).strip() if end else ""
    if start and end:
        return f"{start} – {end}"
    return start or end or ""
