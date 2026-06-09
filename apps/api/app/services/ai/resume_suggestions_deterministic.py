"""Deterministic resume suggestions — the typed fallback for ``resume_suggestions``.

Runs when no ``gemini_api_key`` is configured or Gemini fails after retries. It is
the Python port of ``buildResumeSuggestions`` from
``apps/web/src/lib/resume-suggestion-generator.mjs`` (US-008), re-projected onto
the saved US-028 match analysis snapshot: resume strengths become ``safe_to_use``
positioning rewrites, wording/proof gaps become ``needs_confirmation`` reviews,
and true gaps become ``do_not_use_yet`` Truth Guard blocks. It invents nothing —
every suggestion is derived from gaps/strengths the match analysis already found.
"""

from __future__ import annotations

from typing import Any

# Keyword-driven, so it reports moderate confidence: high enough to count as a
# completed run (>= the 0.6 needs_review threshold), low enough to signal it is
# not the evidence-grounded model output. Mirrors the missing-skills fallback.
DETERMINISTIC_CONFIDENCE = 0.6

# Gap type -> Truth Guard status. Wording/proof gaps may be provable from nearby
# evidence (needs_confirmation); a true gap would add unsupported experience.
_GAP_TYPE_TO_TRUTH_GUARD = {
    "wording_gap": "needs_confirmation",
    "proof_gap": "needs_confirmation",
    "true_gap": "do_not_use_yet",
}


def _clean(value: Any, fallback: str = "") -> str:
    text = str(value if value is not None else fallback).strip()
    return text or fallback


def build_resume_suggestions(*, match_analysis: dict[str, Any], job_title: str) -> dict:
    """Return a ``ResumeSuggestionOutput``-shaped dict (no model call)."""
    strengths = _as_list(match_analysis.get("top_strengths_json"))
    gaps = _as_list(match_analysis.get("top_gaps_json"))

    suggestions: list[dict[str, Any]] = []
    keywords: list[dict[str, Any]] = []
    do_not_claim: list[str] = []

    for strength in strengths[:4]:
        skill = _clean(strength.get("strength") or strength.get("job_requirement"), "Positioning")
        evidence = _clean(strength.get("resume_evidence")) or None
        suggestions.append(
            {
                "section": "experience",
                "original_text": None,
                "suggested_text": (
                    f"Clarify your existing {skill} impact with a concrete result, "
                    "system, or project outcome already supported by your resume."
                ),
                "related_job_requirement": _clean(strength.get("job_requirement"), skill),
                "reason": (
                    f"The match analysis found resume evidence for {skill}, so the "
                    "wording can be sharpened without adding unsupported facts."
                ),
                "evidence": evidence,
                "truth_guard_status": "safe_to_use",
            }
        )
        keywords.append({"keyword": skill, "status": "supported", "evidence": evidence})

    for gap in gaps:
        skill = _clean(gap.get("gap"), "this requirement")
        gap_type = gap.get("gap_type") or "true_gap"
        truth_guard = _GAP_TYPE_TO_TRUTH_GUARD.get(gap_type, "do_not_use_yet")
        requirement = _clean(gap.get("job_requirement"), f"The job lists {skill}.")
        if truth_guard == "needs_confirmation":
            suggestions.append(
                {
                    "section": "experience",
                    "original_text": None,
                    "suggested_text": (
                        f"Review whether your existing work can honestly show stronger "
                        f"{skill} evidence before changing the resume."
                    ),
                    "related_job_requirement": requirement,
                    "reason": (
                        "The resume may have related experience, but the current text "
                        "does not clearly prove it."
                    ),
                    "evidence": _clean(gap.get("why_it_matters")) or None,
                    "truth_guard_status": "needs_confirmation",
                }
            )
            keywords.append({"keyword": skill, "status": "needs_confirmation", "evidence": None})
        else:
            suggestions.append(
                {
                    "section": "skills",
                    "original_text": None,
                    "suggested_text": (
                        f"Do not claim {skill} yet. Build or document real evidence "
                        "first, then add a truthful resume bullet."
                    ),
                    "related_job_requirement": requirement,
                    "reason": "Adding this claim now would create unsupported resume content.",
                    "evidence": None,
                    "truth_guard_status": "do_not_use_yet",
                }
            )
            keywords.append({"keyword": skill, "status": "unsupported", "evidence": None})
            do_not_claim.append(skill)

    if not suggestions:
        suggestions.append(
            {
                "section": "summary",
                "original_text": None,
                "suggested_text": (
                    "Tighten one existing resume bullet by adding scope, production "
                    "context, and a measurable outcome already present in your experience."
                ),
                "related_job_requirement": "General role fit",
                "reason": "The app needs stronger parsed evidence before marking a specific suggestion safe.",
                "evidence": None,
                "truth_guard_status": "needs_confirmation",
            }
        )

    safe = [item["related_job_requirement"] for item in suggestions if item["truth_guard_status"] == "safe_to_use"]
    strategy = (
        f"Lead with the experience you can prove for {job_title}"
        + (f" — emphasize {', '.join(safe[:3])}." if safe else ".")
        + (f" Defer claims about {', '.join(do_not_claim[:3])} until you have real evidence." if do_not_claim else "")
    )
    summary = (
        f"ApplyWise mapped your resume against {job_title}. "
        + (f"You can safely emphasize {', '.join(safe[:3])}. " if safe else "")
        + (f"Do not claim {', '.join(do_not_claim[:3])} without supporting evidence." if do_not_claim else "Focus on sharpening evidence you already have.")
    )

    return {
        "resume_strategy": strategy,
        "assistant_summary": summary,
        "suggestions": suggestions,
        "keywords_to_include": keywords,
        "do_not_claim": do_not_claim,
        "confidence_score": DETERMINISTIC_CONFIDENCE,
    }


def _as_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]
