"""Server-side guards and derivations for the Draft CV (US-039).

The model produces a draft following the enhancement protocol; these pure
functions then *enforce* the guarantees a prompt cannot, after Pydantic
validation and before persistence:

- ``apply_metrics_guard`` — any metric-like number in a bullet that does not
  occur in the candidate's own source text demotes that bullet to
  ``do_not_use_yet`` (it can never reach an export). Impact metrics ($/%) that
  vanished from the draft are reported, not restored.
- ``apply_keyword_support_guard`` — skills and prioritized keywords with no
  occurrence in the source are moved to ``cv_strategy.keywords_excluded``.
- ``apply_xyz_lint`` — bullets not opening with a strong action verb produce a
  ``weak_action_verb`` note (never a silent rewrite).

``assign_bullet_ids`` then serializes to the stored ``cv_json`` shape, adding a
stable ``id`` and ``user_action='pending'`` to each bullet, and
``derive_draft_status`` computes the review/export gate. Both are reused by the
US-040 review PATCH and US-041 export.
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Iterable

from app.schemas.draft_cv import (
    CvBullet,
    DraftCvOutput,
    ExcludedKeyword,
    QualityNote,
)
from app.services.ai.action_verbs import ACTION_VERBS

# A run of digits with optional currency/sign/decimal/percent and a short unit
# suffix: matches "38%", "$1.2M", "120ms", "3x", "10,000", "5+".
_NUMBER_RE = re.compile(r"\$?\d[\d,]*\.?\d*\+?%?[a-zA-Z]{0,2}")
_MAGNITUDE_SUFFIXES = ("k", "m", "b", "x", "ms", "s", "gb", "mb", "tb", "hr", "hrs")


def iter_bullets(output: DraftCvOutput) -> Iterable[CvBullet]:
    """Every experience and project bullet, in document order."""
    for entry in output.work_experience:
        yield from entry.bullets
    for project in output.projects:
        yield from project.bullets


# --- metrics guard --------------------------------------------------------------


def _digit_core(token: str) -> str:
    """The comparable numeric core of a token: digits + internal decimal point.

    ``"38%" -> "38"``, ``"$1.2M" -> "1.2"``, ``"10,000" -> "10000"``.
    """
    cleaned = token.replace(",", "")
    core = re.sub(r"[^\d.]", "", cleaned).strip(".")
    # Collapse a trailing ".0" style noise but keep meaningful decimals.
    return core


def _all_number_cores(text: str) -> set[str]:
    """Every numeric core present in ``text`` (the support set for a corpus)."""
    cores = set()
    for token in _NUMBER_RE.findall(text):
        core = _digit_core(token)
        if core:
            cores.add(core)
    return cores


def _is_metric_like(token: str) -> bool:
    """True for impact-bearing figures; bare small integers are treated as benign.

    Metric-like = has %/$/+, a magnitude suffix, a decimal or thousands group,
    or an integer value >= 10. This keeps the guard from demoting ordinary small
    counts ("2 services") while still catching fabricated impact ("47%", "$1.2M",
    "120ms", "10,000 users").
    """
    lowered = token.lower()
    if any(sym in token for sym in ("%", "$", "+")):
        return True
    if "," in token or "." in token:
        return True
    if any(lowered.rstrip().endswith(suf) for suf in _MAGNITUDE_SUFFIXES):
        return True
    core = _digit_core(token)
    if core and core.isdigit():
        return int(core) >= 10
    return False


def _bullet_metric_cores(text: str) -> set[str]:
    cores = set()
    for token in _NUMBER_RE.findall(text):
        if _is_metric_like(token):
            core = _digit_core(token)
            if core:
                cores.add(core)
    return cores


def _impact_cores(text: str) -> set[str]:
    """Cores of $/%-bearing tokens only (true impact metrics)."""
    cores = set()
    for token in _NUMBER_RE.findall(text):
        if "%" in token or "$" in token:
            core = _digit_core(token)
            if core:
                cores.add(core)
    return cores


def apply_metrics_guard(output: DraftCvOutput, corpus: str) -> list[QualityNote]:
    """Demote bullets that introduce numbers absent from the candidate's source."""
    notes: list[QualityNote] = []
    corpus_cores = _all_number_cores(corpus)

    output_text_parts: list[str] = []
    for bullet in iter_bullets(output):
        output_text_parts.append(bullet.text)
        invented = sorted(_bullet_metric_cores(bullet.text) - corpus_cores)
        if invented and bullet.truth_guard_status != "do_not_use_yet":
            bullet.truth_guard_status = "do_not_use_yet"
            notes.append(
                QualityNote(
                    code="invented_metric",
                    detail=(
                        f"Figure(s) {', '.join(invented)} are not in your resume; "
                        "the bullet was excluded from export until you confirm them."
                    ),
                )
            )

    # Report (do not restore) impact metrics that existed in the source but are
    # absent from every output bullet, so the user can re-add them if wanted.
    dropped = sorted(_impact_cores(corpus) - _all_number_cores(" ".join(output_text_parts)))
    if dropped:
        notes.append(
            QualityNote(
                code="metric_dropped",
                detail=(
                    f"Your resume mentions impact figure(s) {', '.join(dropped)} "
                    "that are not in this draft."
                ),
            )
        )
    return notes


# --- keyword support guard ------------------------------------------------------


def _supported(term: str, corpus_lower: str) -> bool:
    needle = term.strip().lower()
    return bool(needle) and needle in corpus_lower


def _add_excluded(output: DraftCvOutput, keyword: str, reason: str = "unsupported") -> None:
    existing = {e.keyword.lower() for e in output.cv_strategy.keywords_excluded}
    if keyword.lower() not in existing:
        output.cv_strategy.keywords_excluded.append(
            ExcludedKeyword(keyword=keyword, reason=reason)  # type: ignore[arg-type]
        )


def apply_keyword_support_guard(output: DraftCvOutput, corpus: str) -> list[QualityNote]:
    """Strip skills/keywords the candidate's source does not support."""
    notes: list[QualityNote] = []
    corpus_lower = corpus.lower()

    for group in output.skills:
        kept: list[str] = []
        for item in group.items:
            if _supported(item, corpus_lower):
                kept.append(item)
            else:
                _add_excluded(output, item, "unsupported")
                notes.append(
                    QualityNote(
                        code="unsupported_keyword",
                        detail=f"'{item}' was not found in your resume and was excluded.",
                    )
                )
        group.items = kept
    output.skills = [g for g in output.skills if g.items]

    kept_keywords: list[str] = []
    for keyword in output.cv_strategy.keywords_prioritized:
        if _supported(keyword, corpus_lower):
            kept_keywords.append(keyword)
        else:
            _add_excluded(output, keyword, "unsupported")
    output.cv_strategy.keywords_prioritized = kept_keywords
    return notes


# --- XYZ / ATS lint -------------------------------------------------------------


def _first_word(text: str) -> str:
    stripped = text.strip().lstrip("•-–—*").strip()
    match = re.match(r"[A-Za-z']+", stripped)
    return match.group(0) if match else ""


def apply_xyz_lint(output: DraftCvOutput) -> list[QualityNote]:
    notes: list[QualityNote] = []
    for bullet in iter_bullets(output):
        if not bullet.text.strip():
            continue
        word = _first_word(bullet.text)
        if not word or word.lower() not in ACTION_VERBS:
            notes.append(
                QualityNote(
                    code="weak_action_verb",
                    detail=(
                        "Bullet does not start with a strong action verb"
                        + (f" ('{word}…')." if word else ".")
                    ),
                )
            )
    return notes


# --- orchestration --------------------------------------------------------------

LINT_NOTES_NEEDS_REVIEW_THRESHOLD = 2


def run_guards(output: DraftCvOutput, corpus: str) -> list[QualityNote]:
    """Run all guards in order, mutating ``output``; return the collected notes.

    Metrics first (it changes truth-guard status), then keyword support, then the
    soft XYZ lint. The returned notes replace any model-supplied ``quality_notes``.
    """
    notes: list[QualityNote] = []
    notes += apply_metrics_guard(output, corpus)
    notes += apply_keyword_support_guard(output, corpus)
    notes += apply_xyz_lint(output)
    output.quality_notes = notes
    return notes


def lint_forces_review(notes: list[QualityNote]) -> bool:
    weak = sum(1 for n in notes if n.code == "weak_action_verb")
    return weak > LINT_NOTES_NEEDS_REVIEW_THRESHOLD


# --- cv_json assembly + status derivation ---------------------------------------


def assign_bullet_ids(output: DraftCvOutput) -> dict[str, Any]:
    """Serialize to the stored ``cv_json`` shape, adding ``id`` + ``user_action``.

    The model never sees these fields; ids are fresh uuid4s so they are stable
    and unique within a version. ``user_action`` starts ``pending`` and only
    matters for ``needs_confirmation`` bullets.
    """
    cv = output.model_dump(mode="json")
    cv.pop("quality_notes", None)  # stored separately in quality_notes_json
    cv.pop("confidence_score", None)  # lives on the run + the draft row
    cv.pop("cv_strategy", None)  # stored separately in cv_strategy_json
    cv.pop("rendering_recommendation", None)  # stored in rendering_json (US-043)
    for section in ("work_experience", "projects"):
        for entry in cv.get(section, []):
            for bullet in entry.get("bullets", []):
                bullet["id"] = uuid.uuid4().hex
                bullet["user_action"] = "pending"
    return cv


def iter_cv_json_bullets(cv_json: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for section in ("work_experience", "projects"):
        for entry in cv_json.get(section, []) or []:
            for bullet in entry.get("bullets", []) or []:
                yield bullet


def set_bullet_action(cv_json: dict[str, Any], bullet_id: str, user_action: str) -> bool:
    """Set one bullet's ``user_action`` in place; return True if the id was found.

    Used by the US-040 review PATCH. Last-write-wins per bullet. Only
    ``needs_confirmation`` bullets meaningfully change the export gate, but the
    action is stored on whichever bullet matches.
    """
    for bullet in iter_cv_json_bullets(cv_json):
        if bullet.get("id") == bullet_id:
            bullet["user_action"] = user_action
            return True
    return False


def derive_draft_status(cv_json: dict[str, Any], confidence: float | None) -> str:
    """``needs_review`` while any needs_confirmation bullet is unresolved or
    confidence is low; otherwise ``ready_to_export``. ``exported`` is set later by
    a successful export (US-041/US-042), never here."""
    has_pending = any(
        b.get("truth_guard_status") == "needs_confirmation"
        and b.get("user_action", "pending") == "pending"
        for b in iter_cv_json_bullets(cv_json)
    )
    if has_pending:
        return "needs_review"
    if confidence is not None and confidence < 0.5:
        return "needs_review"
    return "ready_to_export"
