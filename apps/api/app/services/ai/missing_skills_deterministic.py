"""Deterministic missing-skill analysis — the typed fallback for ``missing_skills``.

Runs when no ``gemini_api_key`` is configured or Gemini fails after retries. It
invents nothing: it maps the gaps already found by the saved match analysis
(US-028 ``top_gaps_json``) into the Feature 2.4 schema, classifying importance by
rank and evidence status by gap type.
"""

from __future__ import annotations

from typing import Any

# Keyword-driven, so it reports moderate confidence: high enough to count as a
# completed run, low enough to signal it is not the evidence-grounded model output.
DETERMINISTIC_CONFIDENCE = 0.6

_EVIDENCE_BY_GAP_TYPE = {
    "true_gap": "no_evidence",
    "wording_gap": "weak_evidence",
    "proof_gap": "weak_evidence",
}


def build_missing_skill_analysis(*, match_analysis: dict[str, Any], job_title: str) -> dict:
    """Return a Feature 2.4 ``MissingSkillAnalysisOutput``-shaped dict (no model call)."""
    gaps = match_analysis.get("top_gaps_json") or []
    missing: list[dict[str, Any]] = []

    for index, gap in enumerate(gaps):
        if not isinstance(gap, dict):
            continue
        skill = (gap.get("gap") or "").strip()
        if not skill:
            continue
        gap_type = gap.get("gap_type") or "true_gap"
        importance = "critical" if index < 3 else "medium"
        missing.append(
            {
                "skill": skill,
                "importance": importance,
                "gap_type": gap_type,
                "evidence_status": _EVIDENCE_BY_GAP_TYPE.get(gap_type, "no_evidence"),
                "resume_evidence": None,
                "job_requirement": gap.get("job_requirement") or f"The job lists {skill}.",
                "why_it_matters": gap.get("why_it_matters")
                or f"{skill} is required by this role.",
                "how_to_fix": gap.get("suggested_action")
                or f"Add real project or work evidence for {skill}.",
                "suggested_project_task": (
                    f"Build a small project that demonstrates {skill}."
                    if importance == "critical"
                    else None
                ),
                "interview_risk": (
                    f"Expect questions about {skill}; be ready to show concrete experience."
                ),
            }
        )

    top_3 = [item["skill"] for item in missing[:3]]
    if missing:
        summary = (
            f"For {job_title}, the biggest gaps are {', '.join(top_3)}. "
            "Prove these before prioritizing similar roles."
        )
    else:
        summary = (
            f"No significant skill gaps were detected for {job_title} from the "
            "saved match analysis."
        )

    return {
        "summary": summary,
        "missing_skills": missing,
        "top_3_priority_gaps": top_3,
        "confidence_score": DETERMINISTIC_CONFIDENCE,
    }
