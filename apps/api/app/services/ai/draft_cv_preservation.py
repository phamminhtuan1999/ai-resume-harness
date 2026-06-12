"""Regenerate preservation for finalized Draft CV bullets (US-060).

A bullet the user confirmed at final check (``finalized_at`` set) is their
work — regeneration must never silently discard it (decision 0019: no
regenerate lottery). The merge runs in the generation persist step, after the
new ``cv_json`` is assembled:

- the finalized bullet's entry still exists in the new version (matched by
  entry identity: company+title for work experience, name for projects) →
  the bullet is carried in unchanged, replacing a same-text fresh bullet when
  one exists (no duplicates) or appended otherwise;
- the entry was restructured away → the bullet becomes a *conflict* stored in
  ``cv_json.preservation_conflicts``; the UI prompts keep-mine / take-new per
  bullet, and ``resolve_preservation_conflict`` applies the answer.

Pure functions over plain dicts; no I/O.
"""

from __future__ import annotations

from typing import Any

_SECTIONS = ("work_experience", "projects")
_ENTRY_FIELDS = {
    "work_experience": ("company", "title", "location", "start_date", "end_date"),
    "projects": ("name", "description", "tech_stack", "links"),
}


def merge_finalized_bullets(
    new_cv: dict[str, Any], previous_cv: dict[str, Any]
) -> list[dict[str, Any]]:
    """Carry finalized bullets from ``previous_cv`` into ``new_cv`` in place.

    Returns the conflicts (also stored on ``new_cv["preservation_conflicts"]``
    when non-empty)."""
    conflicts: list[dict[str, Any]] = []
    for section in _SECTIONS:
        targets = {
            _entry_key(section, entry): entry
            for entry in new_cv.get(section) or []
        }
        for prev_entry in previous_cv.get(section) or []:
            finalized = [
                bullet
                for bullet in prev_entry.get("bullets") or []
                if bullet.get("finalized_at")
            ]
            if not finalized:
                continue
            target = targets.get(_entry_key(section, prev_entry))
            if target is None:
                conflicts.extend(
                    {
                        "section": section,
                        "entry": _entry_shell(section, prev_entry),
                        "bullet": bullet,
                    }
                    for bullet in finalized
                )
                continue
            bullets = target.setdefault("bullets", [])
            for bullet in finalized:
                replaced = False
                for index, fresh in enumerate(bullets):
                    if fresh.get("finalized_at"):
                        continue
                    if _norm(fresh.get("text")) == _norm(bullet.get("text")):
                        bullets[index] = bullet
                        replaced = True
                        break
                if not replaced:
                    bullets.append(bullet)

    if conflicts:
        new_cv["preservation_conflicts"] = conflicts
    return conflicts


def resolve_preservation_conflict(
    cv_json: dict[str, Any], bullet_id: str, choice: str
) -> bool:
    """Apply one keep-mine / take-new answer. ``choice``: keep | discard.

    ``keep`` re-attaches the bullet under its previous entry (recreating the
    entry shell when the new version no longer has it); ``discard`` accepts the
    regenerated content. Returns False when the conflict is unknown."""
    conflicts = cv_json.get("preservation_conflicts") or []
    match = next(
        (c for c in conflicts if (c.get("bullet") or {}).get("id") == bullet_id),
        None,
    )
    if match is None:
        return False

    if choice == "keep":
        section = match.get("section") or "work_experience"
        entries = cv_json.setdefault(section, [])
        key = _entry_key(section, match.get("entry") or {})
        target = next(
            (entry for entry in entries if _entry_key(section, entry) == key), None
        )
        if target is None:
            target = {**(match.get("entry") or {}), "bullets": []}
            entries.append(target)
        target.setdefault("bullets", []).append(match["bullet"])

    remaining = [c for c in conflicts if c is not match]
    if remaining:
        cv_json["preservation_conflicts"] = remaining
    else:
        cv_json.pop("preservation_conflicts", None)
    return True


def _entry_key(section: str, entry: dict[str, Any]) -> tuple[str, ...]:
    if section == "projects":
        return (_norm(entry.get("name")),)
    return (_norm(entry.get("company")), _norm(entry.get("title")))


def _entry_shell(section: str, entry: dict[str, Any]) -> dict[str, Any]:
    return {
        field: entry.get(field)
        for field in _ENTRY_FIELDS[section]
        if entry.get(field) is not None
    }


def _norm(value: Any) -> str:
    return " ".join(str(value or "").split()).casefold()
