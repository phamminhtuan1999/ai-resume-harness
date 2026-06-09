"""Interview prep output schema (US-035, Feature 7.4).

Job-specific question sets, ranked weak topics, and per-question answer
guidance. The truthfulness contract lives in ``AnswerGuidanceItem``: when the
resume has no supporting evidence, ``resume_evidence_to_use`` is null and
``warning`` carries a study/build-proof instruction — the assistant never
implies experience the candidate does not have.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.ai_workflow import AIOutputBase


class AnswerGuidanceItem(BaseModel):
    question: str
    recommended_angle: str = ""
    resume_evidence_to_use: str | None = None
    warning: str | None = None


class InterviewPrepOutput(AIOutputBase):
    prep_summary: str = ""
    technical_questions: list[str] = Field(min_length=1)
    ai_llm_questions: list[str] = Field(min_length=1)
    system_design_questions: list[str] = Field(min_length=1)
    behavioral_questions: list[str] = Field(min_length=1)
    weak_topics_to_study: list[str] = Field(default_factory=list)
    answer_guidance: list[AnswerGuidanceItem] = Field(default_factory=list)
