"""Match analysis output schema and scoring helpers (US-028, Feature 1.4).

The model produces evidence-based analysis; the server owns the scoring contract:
``overall_score`` is always recomputed from the accepted weighting (never trusted
from the model), and the apply recommendation / labels are derived from score
bands. A strength without ``resume_evidence`` is dropped so the assistant never
claims unevidenced strengths.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.ai_workflow import AIOutputBase

ApplyRecommendation = Literal[
    "apply_now", "apply_with_improvements", "improve_first", "not_recommended"
]
GapType = Literal["true_gap", "wording_gap", "proof_gap"]

# Accepted weighting (docs/product/ai-workflows.md). The model's sub-scores are
# advisory inputs; overall is computed here.
SCORE_WEIGHTS: dict[str, float] = {
    "skill": 0.30,
    "experience": 0.20,
    "ai_readiness": 0.25,
    "ats_keyword": 0.15,
    "seniority": 0.10,
}


class Strength(BaseModel):
    strength: str
    resume_evidence: str = ""
    job_requirement: str = ""
    why_it_matters: str = ""


class Gap(BaseModel):
    gap: str
    gap_type: GapType = "true_gap"
    job_requirement: str = ""
    why_it_matters: str = ""
    suggested_action: str = ""


class ScoreExplanations(BaseModel):
    skill: str = ""
    experience: str = ""
    ai_readiness: str = ""
    ats_keyword: str = ""
    seniority: str = ""


class MatchAnalysisOutput(AIOutputBase):
    overall_score: int = Field(default=0, ge=0, le=100)
    skill_score: int = Field(default=0, ge=0, le=100)
    experience_score: int = Field(default=0, ge=0, le=100)
    ai_readiness_score: int = Field(default=0, ge=0, le=100)
    ats_keyword_score: int = Field(default=0, ge=0, le=100)
    seniority_score: int = Field(default=0, ge=0, le=100)
    location_score: int = Field(default=0, ge=0, le=100)
    seniority_match_label: str = ""
    apply_recommendation: ApplyRecommendation = "improve_first"
    assistant_summary: str = ""
    fit_reasoning: str = ""
    score_explanations: ScoreExplanations = Field(default_factory=ScoreExplanations)
    top_strengths: list[Strength] = Field(default_factory=list)
    top_gaps: list[Gap] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    next_best_action: str = ""

    @field_validator("top_strengths")
    @classmethod
    def _drop_unevidenced_strengths(cls, value: list[Strength]) -> list[Strength]:
        # Story 1.2 rule: a strength with no resume evidence is not a strength.
        return [s for s in value if s.resume_evidence and s.resume_evidence.strip()]


def reconcile_overall_score(output: MatchAnalysisOutput) -> int:
    """Recompute ``overall_score`` from sub-scores and the accepted weighting."""
    weighted = (
        output.skill_score * SCORE_WEIGHTS["skill"]
        + output.experience_score * SCORE_WEIGHTS["experience"]
        + output.ai_readiness_score * SCORE_WEIGHTS["ai_readiness"]
        + output.ats_keyword_score * SCORE_WEIGHTS["ats_keyword"]
        + output.seniority_score * SCORE_WEIGHTS["seniority"]
    )
    return max(0, min(100, round(weighted)))


def score_to_label(overall: int) -> str:
    """Overall-score category. Band boundaries: 40 / 60 / 75 / 90."""
    if overall >= 90:
        return "Strong match"
    if overall >= 75:
        return "Good match"
    if overall >= 60:
        return "Possible match with gaps"
    if overall >= 40:
        return "Weak match"
    return "Not recommended yet"


def score_to_recommendation(overall: int) -> ApplyRecommendation:
    """Map an overall score to an apply recommendation (one per band)."""
    if overall >= 75:
        return "apply_now"
    if overall >= 60:
        return "apply_with_improvements"
    if overall >= 40:
        return "improve_first"
    return "not_recommended"
