"""Deterministic, selection-only Draft CV compression (US-045, Period 10).

``build_compressed_render_model`` projects a stored ``cv_json`` into the same
filtered render-model shape as ``render_model.build_render_model`` — but
*selects* a subset to fit a page target (decision 0014 §3). It never rewrites
or adds text: every output bullet is a verbatim renderable bullet, so the
truth-guard gating (``is_renderable``) can never be bypassed. A **protected
floor** — bullets carrying real impact metrics or prioritized-keyword evidence
— is never dropped; if the floor alone overflows, the measure loop reports a
``page_overflow`` and the page target yields (the target is soft, the floor is
hard).

Ordered levels L0–L3 progressively tighten per-entry bullet caps, project
count, skill duplication, and summary length. The measure loop in
``pdf_renderer`` walks the levels until the rendered PDF fits. Pure functions,
deterministic for a given (cv_json, config, level).
"""

from __future__ import annotations

import re
from typing import Any

from app.services.export.render_config import RenderConfig
from app.services.export.render_model import build_render_model, is_renderable

MAX_LEVEL = 3

_NUMBER_RE = re.compile(r"\$?\d[\d,]*\.?\d*%?")


def _has_impact_metric(text: str) -> bool:
    return any(("%" in tok or "$" in tok) for tok in _NUMBER_RE.findall(text))


def _has_number(text: str) -> bool:
    return bool(_NUMBER_RE.findall(text))


def _keyword_evidence(bullet: dict[str, Any], prioritized: set[str]) -> bool:
    if not prioritized:
        return False
    used = {k.lower() for k in (bullet.get("keywords_used") or [])}
    if used & prioritized:
        return True
    text = (bullet.get("text") or "").lower()
    return any(kw in text for kw in prioritized)


def score_bullet(bullet: dict[str, Any], prioritized: set[str]) -> int:
    """3·(prioritized-keyword evidence) + 2·(impact metric) + 1·(any number).
    Higher = more job-relevant; ties broken by document order at selection."""
    text = bullet.get("text") or ""
    score = 0
    if _keyword_evidence(bullet, prioritized):
        score += 3
    if _has_impact_metric(text):
        score += 2
    if _has_number(text):
        score += 1
    return score


def is_protected(bullet: dict[str, Any], prioritized: set[str]) -> bool:
    """The floor: impact metrics and prioritized-keyword evidence are never
    dropped (decision 0014 §3 / brief §5 'must not remove')."""
    return _has_impact_metric(bullet.get("text") or "") or _keyword_evidence(
        bullet, prioritized
    )


def _caps_for_level(config: RenderConfig, level: int) -> tuple[int, int, int, bool]:
    """(recent bullet cap, older bullet cap, project limit, dedupe skills)."""
    recent = config.recent_bullet_cap
    older = config.older_bullet_cap
    projects = config.project_limit
    dedupe = False
    if level >= 1:
        older = max(1, config.older_bullet_cap - 1)
        projects = max(1, config.project_limit - 1)
    if level >= 2:
        recent = max(2, config.recent_bullet_cap - 1)
        older = 1
        dedupe = True
    if level >= 3:
        older = 1
        projects = 1
        dedupe = True
    return recent, older, projects, dedupe


def _select_bullets(
    renderable: list[dict[str, Any]], cap: int, prioritized: set[str]
) -> tuple[list[str], list[dict[str, Any]], int]:
    """Keep all protected bullets + the top-scoring unprotected up to ``cap``,
    in document order. Returns (kept_texts, dropped_records, protected_count).
    Protected bullets always survive even if they alone exceed the cap."""
    scored = [
        (idx, bullet, score_bullet(bullet, prioritized), is_protected(bullet, prioritized))
        for idx, bullet in enumerate(renderable)
    ]
    protected = [s for s in scored if s[3]]
    unprotected = [s for s in scored if not s[3]]
    slots = max(0, cap - len(protected))
    keep_unprotected = sorted(unprotected, key=lambda s: (-s[2], s[0]))[:slots]
    keep_idx = {s[0] for s in protected} | {s[0] for s in keep_unprotected}

    kept_texts: list[str] = []
    dropped: list[dict[str, Any]] = []
    for idx, bullet, _score, _prot in scored:
        text = (bullet.get("text") or "").strip()
        if not text:
            continue
        if idx in keep_idx:
            kept_texts.append(text)
        else:
            dropped.append({"kind": "bullet", "text": text, "reason": "over_cap"})
    return kept_texts, dropped, len(protected)


def _select_projects(
    base_projects: list[dict[str, Any]],
    cv_projects: list[dict[str, Any]],
    project_limit: int,
    prioritized: set[str],
) -> tuple[list[int], list[dict[str, Any]]]:
    """Keep projects containing protected bullets, then the highest-relevance
    remaining up to ``project_limit``. Returns (kept indices ascending, dropped
    whole-project records)."""
    protected_idx: set[int] = set()
    relevance: list[tuple[int, int]] = []
    for i, cv_proj in enumerate(cv_projects):
        renderable = [b for b in (cv_proj.get("bullets") or []) if is_renderable(b)]
        if any(is_protected(b, prioritized) for b in renderable):
            protected_idx.add(i)
        relevance.append((i, sum(score_bullet(b, prioritized) for b in renderable)))

    keep = set(protected_idx)
    slots = max(0, project_limit - len(protected_idx))
    rest = [r for r in relevance if r[0] not in protected_idx]
    for i, _score in sorted(rest, key=lambda r: (-r[1], r[0]))[:slots]:
        keep.add(i)

    dropped = [
        {"kind": "project", "text": base_projects[i].get("name") or "", "reason": "project_limit"}
        for i in range(len(base_projects))
        if i not in keep
    ]
    return sorted(keep), dropped


_SENTENCE_END_RE = re.compile(r"[.!?](?:\s|$)")


def _truncate_summary(text: str, cap: int) -> tuple[str, bool]:
    """Truncate at the last sentence boundary within ``cap`` (never mid-word).
    Selection-only: words are dropped, never reworded."""
    if len(text) <= cap:
        return text, False
    window = text[:cap]
    boundaries = [m.end() for m in _SENTENCE_END_RE.finditer(window)]
    if boundaries and boundaries[-1] > cap // 2:
        return window[: boundaries[-1]].strip(), True
    space = window.rfind(" ")
    cut = window[:space] if space > 0 else window
    return cut.strip(), True


def build_compressed_render_model(
    cv_json: dict[str, Any],
    *,
    config: RenderConfig,
    level: int,
    prioritized_keywords: tuple[str, ...] = (),
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (render_model, compression_report). The model is always a subset
    of ``build_render_model(cv_json)`` — compression only removes content."""
    base = build_render_model(cv_json)
    recent_cap, older_cap, project_limit, dedupe = _caps_for_level(config, level)
    prioritized = {k.lower() for k in prioritized_keywords}

    report: dict[str, Any] = {
        "applied": False,
        "level": level,
        "steps_applied": [],
        "dropped": [],
        "skills_deduped": [],
        "summary_truncated": False,
        "protected_kept": 0,
        "page_target": config.page_target,
        "density": config.density,
        "measured_pages": None,
        "page_overflow": False,
    }

    cv_work = cv_json.get("work_experience") or []
    for i, entry_base in enumerate(base["work_experience"]):
        cv_entry = cv_work[i] if i < len(cv_work) else {}
        renderable = [b for b in (cv_entry.get("bullets") or []) if is_renderable(b)]
        cap = recent_cap if i < config.recent_entry_count else older_cap
        kept, dropped, n_protected = _select_bullets(renderable, cap, prioritized)
        entry_base["bullets"] = kept
        label = entry_base.get("company") or entry_base.get("title") or ""
        for record in dropped:
            report["dropped"].append({**record, "section": "work_experience", "entry": label})
        report["protected_kept"] += n_protected

    cv_proj = cv_json.get("projects") or []
    keep_indices, dropped_projects = _select_projects(
        base["projects"], cv_proj, project_limit, prioritized
    )
    new_projects: list[dict[str, Any]] = []
    for i in keep_indices:
        entry_base = base["projects"][i]
        renderable = [b for b in (cv_proj[i].get("bullets") or []) if is_renderable(b)]
        kept, dropped, n_protected = _select_bullets(renderable, older_cap, prioritized)
        entry_base["bullets"] = kept
        label = entry_base.get("name") or ""
        for record in dropped:
            report["dropped"].append({**record, "section": "projects", "entry": label})
        report["protected_kept"] += n_protected
        new_projects.append(entry_base)
    base["projects"] = new_projects
    report["dropped"].extend(dropped_projects)

    if dedupe:
        seen: set[str] = set()
        deduped_groups: list[dict[str, Any]] = []
        for group in base["skills"]:
            kept_items: list[str] = []
            for item in group.get("items") or []:
                key = item.lower()
                if key in seen:
                    report["skills_deduped"].append(item)
                else:
                    seen.add(key)
                    kept_items.append(item)
            if kept_items:
                group["items"] = kept_items
                deduped_groups.append(group)
        base["skills"] = deduped_groups

    # Summary truncation is a later-stage lever (L2+), so an uncompressed L0
    # render keeps the full summary; under page pressure it tightens to the
    # density's cap at a sentence boundary (selection-only, never reworded).
    if level >= 2:
        summary, truncated = _truncate_summary(
            base.get("professional_summary") or "", config.summary_cap
        )
        base["professional_summary"] = summary
        report["summary_truncated"] = truncated

    steps: list[str] = []
    if any(d["kind"] == "bullet" for d in report["dropped"]):
        steps.append("dropped_bullets")
    if any(d["kind"] == "project" for d in report["dropped"]):
        steps.append("dropped_projects")
    if report["skills_deduped"]:
        steps.append("deduped_skills")
    if report["summary_truncated"]:
        steps.append("truncated_summary")
    report["steps_applied"] = steps
    report["applied"] = bool(steps)

    return base, report
