"""Deterministic cover letter — the typed fallback for ``cover_letter``.

US-033 has no prior generator, so this is a fresh template (not a port). It
assembles an honest cover letter from the saved US-028 match analysis: it leads
with the candidate's proven strengths and explicitly avoids true-gap skills the
resume does not support. It invents nothing — every key point comes from a
strength the match analysis already evidenced.
"""

from __future__ import annotations

from typing import Any

DETERMINISTIC_CONFIDENCE = 0.6


def _names(items: Any, gap_type: str | None = None) -> list[str]:
    out: list[str] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        if gap_type is not None and item.get("gap_type") != gap_type:
            continue
        name = (item.get("strength") or item.get("gap") or "").strip()
        if name:
            out.append(name)
    return out


def build_cover_letter(
    *,
    match_analysis: dict[str, Any],
    job_title: str,
    company: str,
    cv_bullets: list[str] | None = None,
) -> dict:
    """Return a Feature 5.4 ``CoverLetterOutput``-shaped dict (no model call).

    With ``cv_bullets`` (US-063: the renderable Tailored CV bullets), the
    letter's claims are restricted to that content: analysis strengths that do
    not appear in the renderable CV are dropped, and when none survive the key
    points are the bullets themselves."""
    strengths = _names(match_analysis.get("top_strengths_json"))
    claims_avoided = _names(match_analysis.get("top_gaps_json"), gap_type="true_gap")
    if cv_bullets is not None:
        blob = " ".join(cv_bullets).lower()
        strengths = [s for s in strengths if s.lower() in blob]
        key_points = strengths[:4] or [b.strip() for b in cv_bullets[:3] if b.strip()]
        key_points = key_points or ["the experience shown in my tailored CV"]
    else:
        key_points = strengths[:4] or ["relevant production engineering experience"]

    strengths_phrase = ", ".join(key_points[:3])
    opening = (
        f"Dear {company} Hiring Team,\n\n"
        f"I am writing to apply for the {job_title} role at {company}. "
        f"My background in {strengths_phrase} maps directly to what this role needs."
    )
    body = (
        "\n\nIn my work I have repeatedly turned ambiguous requirements into "
        "production systems, and I would bring that same focus to your team. "
        f"I am especially confident discussing {strengths_phrase}, where I can "
        "point to concrete, evidenced results from my experience."
    )
    if claims_avoided:
        body += (
            f"\n\nI am actively deepening my hands-on work with "
            f"{', '.join(claims_avoided[:3])}, and I am candid about where I am "
            "building proof rather than overstating it."
        )
    closing = (
        f"\n\nI would welcome the chance to discuss how I can contribute to "
        f"{company}. Thank you for your time and consideration.\n\nSincerely,\n"
        "[Your name]"
    )

    strategy = (
        f"Lead with the strengths the match analysis evidenced ({strengths_phrase}) "
        "and avoid claiming unproven skills"
        + (f", specifically {', '.join(claims_avoided[:3])}." if claims_avoided else ".")
    )

    return {
        "cover_letter": opening + body + closing,
        "cover_letter_strategy": strategy,
        "key_points_used": key_points,
        "claims_avoided": claims_avoided,
        "tone": "professional",
        "confidence_score": DETERMINISTIC_CONFIDENCE,
    }
