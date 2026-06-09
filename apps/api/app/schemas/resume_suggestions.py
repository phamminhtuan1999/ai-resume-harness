"""Resume suggestions output schema (US-031, Feature 3.4).

Tailored, section-by-section resume rewrites for one match. Every suggestion
carries a Truth Guard status the model returns in snake_case; the workflow maps
it to the title-case display value the existing ``resume_suggestions`` table
already stores (see ``TRUTH_GUARD_DISPLAY``). The model also produces a resume
strategy narrative, a keyword inclusion list, and an explicit do-not-claim list,
all stored in ``ai_workflow_runs.output_snapshot_json``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai_workflow import AIOutputBase

SuggestionSection = Literal[
    "summary", "skills", "experience", "projects", "education", "other"
]
TruthGuardStatus = Literal["safe_to_use", "needs_confirmation", "do_not_use_yet"]
KeywordStatus = Literal["supported", "needs_confirmation", "unsupported"]

# The AI returns snake_case; the existing table stores title-case display values.
# Mapping is applied in the workflow before any DB insert.
TRUTH_GUARD_DISPLAY: dict[str, str] = {
    "safe_to_use": "Safe to use",
    "needs_confirmation": "Needs confirmation",
    "do_not_use_yet": "Do not use yet",
}


class SuggestionItem(BaseModel):
    section: SuggestionSection = "other"
    original_text: str | None = None
    suggested_text: str = ""
    related_job_requirement: str = ""
    reason: str = ""
    evidence: str | None = None
    truth_guard_status: TruthGuardStatus = "needs_confirmation"


class KeywordItem(BaseModel):
    keyword: str
    status: KeywordStatus = "needs_confirmation"
    evidence: str | None = None


class ResumeSuggestionOutput(AIOutputBase):
    resume_strategy: str = ""
    assistant_summary: str = ""
    suggestions: list[SuggestionItem] = Field(default_factory=list)
    keywords_to_include: list[KeywordItem] = Field(default_factory=list)
    do_not_claim: list[str] = Field(default_factory=list)
