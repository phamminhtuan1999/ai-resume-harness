"""Deterministic match analyzer — the typed fallback for ``match_analysis``.

A faithful Python port of ``apps/web/src/lib/match-analyzer.mjs`` (US-007) mapped
into the Feature 1.4 schema. It runs when no ``gemini_api_key`` is configured or
when Gemini generation fails after retries. It invents nothing: strengths are
only emitted for skills that literally appear in the resume text (so they carry
real ``resume_evidence``), and gaps are skills required by the job but absent
from the resume.
"""

from __future__ import annotations

import re

from app.schemas.match_analysis import (
    SCORE_WEIGHTS,
    score_to_label,
    score_to_recommendation,
)

AI_SKILLS = [
    "python",
    "fastapi",
    "llm",
    "rag",
    "vector database",
    "embeddings",
    "langchain",
    "langgraph",
    "prompt engineering",
    "tool calling",
    "agents",
    "evaluation",
    "docker",
    "aws",
    "gcp",
    "azure",
    "sql",
    "postgres",
    "api design",
    "observability",
    "testing",
    "security",
]
SENIORITY_TERMS = ["junior", "mid", "senior", "staff", "principal", "lead"]

# The deterministic baseline is keyword-driven, so it reports moderate confidence:
# high enough to count as a completed run, low enough to signal it is not the
# evidence-grounded model output.
DETERMINISTIC_CONFIDENCE = 0.6


def _normalize_text(value: str | None) -> str:
    text = (value or "").lower()
    text = re.sub(r"[^\w+#./ -]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _has_term(text: str, term: str) -> bool:
    escaped = re.escape(term)
    return re.search(rf"(^|[^a-z0-9+#]){escaped}([^a-z0-9+#]|$)", text, re.IGNORECASE) is not None


def _extract_skills(text: str) -> list[str]:
    normalized = _normalize_text(text)
    return [skill for skill in AI_SKILLS if _has_term(normalized, skill)]


def _extract_years(text: str) -> int | None:
    normalized = _normalize_text(text)
    matches = re.findall(r"(\d{1,2})\+?\s*(?:years|yrs)", normalized)
    years = [int(m) for m in matches]
    return max(years) if years else None


def _extract_seniority(text: str) -> str | None:
    normalized = _normalize_text(text)
    for term in SENIORITY_TERMS:
        if _has_term(normalized, term):
            return term
    return None


def _clamp(value: float) -> int:
    return max(0, min(100, round(value)))


def _score_coverage(matched: int, required: int) -> int:
    if required == 0:
        return 70
    return _clamp((matched / required) * 100)


def _score_experience(resume_years: int | None, job_years: int | None) -> int:
    if not job_years:
        return 80 if resume_years else 65
    if not resume_years:
        return 45
    return _clamp((resume_years / job_years) * 100)


def _score_seniority(resume_seniority: str | None, job_seniority: str | None) -> int:
    if not job_seniority:
        return 70
    if not resume_seniority:
        return 50
    resume_index = SENIORITY_TERMS.index(resume_seniority)
    job_index = SENIORITY_TERMS.index(job_seniority)
    if resume_index >= job_index:
        return 90
    if job_index - resume_index == 1:
        return 65
    return 40


def analyze_resume_job_fit(*, resume_text: str, job_description: str) -> dict:
    """Return a Feature 1.4 ``MatchAnalysisOutput``-shaped dict (no model call)."""
    resume_skills = _extract_skills(resume_text)
    job_skills = _extract_skills(job_description)
    matched_skills = [s for s in job_skills if s in resume_skills]
    missing_skills = [s for s in job_skills if s not in matched_skills]

    resume_years = _extract_years(resume_text)
    job_years = _extract_years(job_description)
    resume_seniority = _extract_seniority(resume_text)
    job_seniority = _extract_seniority(job_description)

    ai_core = AI_SKILLS[:12]
    skill_score = _score_coverage(len(matched_skills), len(job_skills))
    ai_readiness_score = _score_coverage(
        len([s for s in matched_skills if s in ai_core]),
        len([s for s in job_skills if s in ai_core]),
    )
    ats_keyword_score = _score_coverage(len(matched_skills), len(set(job_skills)))
    experience_score = _score_experience(resume_years, job_years)
    seniority_score = _score_seniority(resume_seniority, job_seniority)

    overall_score = _clamp(
        skill_score * SCORE_WEIGHTS["skill"]
        + experience_score * SCORE_WEIGHTS["experience"]
        + ai_readiness_score * SCORE_WEIGHTS["ai_readiness"]
        + ats_keyword_score * SCORE_WEIGHTS["ats_keyword"]
        + seniority_score * SCORE_WEIGHTS["seniority"]
    )
    label = score_to_label(overall_score)

    top_strengths = [
        {
            "strength": skill,
            # Truthful evidence: the skill literally appears in the resume text.
            "resume_evidence": f"Your resume mentions {skill}.",
            "job_requirement": f"The job lists {skill}.",
            "why_it_matters": f"{skill} is required by this role and present in your resume.",
        }
        for skill in matched_skills
    ]

    top_gaps = [
        {
            "gap": skill,
            "gap_type": "true_gap",
            "job_requirement": f"The job lists {skill}.",
            "why_it_matters": (
                f"{skill} appears in the job description but not in your resume text."
            ),
            "suggested_action": (
                f"Add real project or work evidence for {skill} before claiming it."
            ),
        }
        for skill in missing_skills
    ]

    seniority_label = (
        f"{resume_seniority} vs {job_seniority}"
        if resume_seniority and job_seniority
        else (job_seniority or "unspecified")
    )

    return {
        "overall_score": overall_score,
        "skill_score": skill_score,
        "experience_score": experience_score,
        "ai_readiness_score": ai_readiness_score,
        "ats_keyword_score": ats_keyword_score,
        "seniority_score": seniority_score,
        "location_score": 0,
        "seniority_match_label": seniority_label,
        "apply_recommendation": score_to_recommendation(overall_score),
        "assistant_summary": (
            f"{label}: keyword analysis matched {len(matched_skills)} of "
            f"{len(job_skills)} job skills for an overall fit of {overall_score}%."
        ),
        "fit_reasoning": (
            "Generated by the deterministic baseline analyzer (keyword and "
            "experience matching). Configure the model for evidence-based reasoning."
        ),
        "score_explanations": {
            "skill": f"Matched {len(matched_skills)} of {len(job_skills)} job skills.",
            "experience": (
                f"Resume shows {resume_years or 'unstated'} years; "
                f"job expects {job_years or 'unstated'}."
            ),
            "ai_readiness": "Coverage of core AI/ML keywords from the job description.",
            "ats_keyword": "Share of job keywords present verbatim in the resume.",
            "seniority": f"Seniority signal: {seniority_label}.",
        },
        "top_strengths": top_strengths,
        "top_gaps": top_gaps,
        "risks": [
            f"{gap['gap']} may be screened as missing." for gap in top_gaps[:3]
        ],
        "next_best_action": (
            top_gaps[0]["suggested_action"]
            if top_gaps
            else "Tailor your resume wording to the job's exact keywords."
        ),
        "confidence_score": DETERMINISTIC_CONFIDENCE,
    }
