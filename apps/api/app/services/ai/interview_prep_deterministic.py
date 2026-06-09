"""Deterministic interview-prep fallback (US-035).

Python port of ``buildInterviewPrep`` from
``apps/web/src/lib/interview-prep-generator.mjs`` (US-011), upgraded to the
Feature 7.4 output schema. Questions come from the saved match analysis
(strengths/gaps), weak topics from the US-029 missing-skill analysis, and the
answer guidance keeps the truthfulness contract: weak topics get null evidence
plus an explicit study/build-proof warning. ``confidence_score`` is fixed at
0.5 (below the 0.6 bar, so fallback preps surface as ``needs_review``).
"""

from __future__ import annotations

from typing import Any

FALLBACK_CONFIDENCE = 0.5


def _strength_items(match_analysis: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        s
        for s in match_analysis.get("top_strengths_json") or []
        if isinstance(s, dict) and s.get("strength")
    ]


def _gap_names(match_analysis: dict[str, Any]) -> list[str]:
    return [
        str(g["gap"]).strip()
        for g in match_analysis.get("top_gaps_json") or []
        if isinstance(g, dict) and g.get("gap")
    ]


def _weak_topics(
    missing_skills: list[dict[str, Any]], match_analysis: dict[str, Any]
) -> list[str]:
    topics = [
        str(s["skill"]).strip()
        for s in missing_skills
        if isinstance(s, dict) and s.get("skill")
    ]
    if topics:
        return topics[:5]
    return _gap_names(match_analysis)[:5] or ["Interview evidence depth"]


def build_interview_prep(
    *,
    match_analysis: dict[str, Any],
    missing_skills: list[dict[str, Any]],
    job_title: str,
    company: str,
    target_role: str,
) -> dict[str, Any]:
    """Schema-valid Feature 7.4 prep package without a model call."""
    role = (job_title or target_role or "the target role").strip()
    org = (company or "the target company").strip() or "the target company"

    strengths = _strength_items(match_analysis)
    top_strength = (
        str(strengths[0].get("strength")) if strengths else "your strongest resume evidence"
    )
    second_strength = (
        str(strengths[1].get("strength")) if len(strengths) > 1 else top_strength
    )
    gaps = _gap_names(match_analysis)
    top_gap = gaps[0] if gaps else "role-specific AI depth"
    risks = [str(r) for r in match_analysis.get("risks_json") or [] if r]
    top_risk = risks[0] if risks else "screening concerns about missing evidence"
    weak_topics = _weak_topics(missing_skills, match_analysis)

    technical_questions = [
        f"How have you used {top_strength} in a production or project setting?",
        f"Walk me through a recent project where you applied {second_strength}.",
        f"What would you do if {top_gap} came up during implementation?",
        "How do you test, debug, and verify systems you have built recently?",
    ]
    ai_llm_questions = [
        f"How would you evaluate an AI feature for {role} at {org}?",
        f"What is your plan to close the {top_gap} gap?",
        "How would you design a RAG pipeline and decide its chunking and retrieval strategy?",
        "How do you keep LLM outputs structured and validated in production?",
    ]
    system_design_questions = [
        f"Design a reliable workflow for an AI resume or job matching feature at {org}.",
        f"How would you monitor quality, latency, and regressions for an AI service supporting {role}?",
    ]
    behavioral_questions = [
        "Tell me about a time you learned a missing skill quickly for a project.",
        f"How would you address {top_risk} if the interviewer asks about it directly?",
        "Describe a time you disagreed with a teammate about a technical approach and how it resolved.",
    ]

    guidance: list[dict[str, Any]] = []
    for index, item in enumerate(strengths[:2]):
        evidence = item.get("resume_evidence") or item.get("strength")
        guidance.append(
            {
                "question": technical_questions[min(index, 1)],
                "recommended_angle": (
                    f"Anchor the answer in this resume evidence: {item.get('strength')}."
                ),
                "resume_evidence_to_use": str(evidence) if evidence else None,
                "warning": None,
            }
        )
    for topic in weak_topics[:2]:
        guidance.append(
            {
                "question": f"What is your hands-on experience with {topic}?",
                "recommended_angle": (
                    "Be honest that proof is limited; describe your study plan and any "
                    "prototype work instead of claiming depth."
                ),
                "resume_evidence_to_use": None,
                "warning": (
                    f"No resume evidence found for {topic}. Study it and build a small "
                    "proof project before claiming hands-on depth."
                ),
            }
        )

    return {
        "prep_summary": (
            f"Expect this {role} interview at {org} to probe {top_gap} and the other "
            f"gaps from your analysis. Your strongest supported angle is {top_strength}. "
            f"Prepare honest, study-plan answers for {len(weak_topics)} weak topic(s) "
            "rather than implying experience you cannot back up."
        ),
        "technical_questions": technical_questions,
        "ai_llm_questions": ai_llm_questions,
        "system_design_questions": system_design_questions,
        "behavioral_questions": behavioral_questions,
        "weak_topics_to_study": weak_topics,
        "answer_guidance": guidance,
        "confidence_score": FALLBACK_CONFIDENCE,
    }
