"""Tailored resume Markdown draft output schema (US-032, Feature 4.4).

Assembles a job-specific Markdown resume from the canonical resume text plus the
accepted/safe US-031 suggestions. Unsupported (``do_not_use_yet``) and rejected
suggestions are excluded by default and reported in ``excluded_suggestions``.
MVP output is Markdown/text only; PDF/DOCX export is post-MVP.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai_workflow import AIOutputBase

ExclusionReason = Literal["unsupported", "not_selected", "low_confidence"]


class ExcludedSuggestion(BaseModel):
    suggestion: str
    reason: ExclusionReason = "not_selected"


class ResumeDraftOutput(AIOutputBase):
    resume_markdown: str = ""
    tailoring_summary: str = ""
    included_suggestions: list[str] = Field(default_factory=list)
    excluded_suggestions: list[ExcludedSuggestion] = Field(default_factory=list)
    quality_notes: list[str] = Field(default_factory=list)
