"""Cover letter output schema (US-033, Feature 5.4).

A personalized, honest cover letter per match: built around the candidate's
strongest supported angle from the match analysis, referencing the company and
role when known, and explicitly avoiding claims the resume does not support.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.ai_workflow import AIOutputBase

Tone = Literal["professional", "concise", "enthusiastic"]


class CoverLetterOutput(AIOutputBase):
    cover_letter: str = ""
    cover_letter_strategy: str = ""
    key_points_used: list[str] = Field(default_factory=list)
    claims_avoided: list[str] = Field(default_factory=list)
    tone: Tone = "professional"
