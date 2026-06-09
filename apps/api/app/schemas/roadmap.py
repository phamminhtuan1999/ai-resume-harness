"""Roadmap output schema (US-034, Feature 6.4).

A 4-week improvement roadmap closing the most critical skill gaps found by the
missing-skill analysis (US-029). The exactly-4-weeks rule is part of the schema
so an invalid model response fails validation inside the provider (retry once,
then deterministic fallback) instead of reaching persistence.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.schemas.ai_workflow import AIOutputBase


class RoadmapWeek(BaseModel):
    week: int
    goal: str = ""
    skills_covered: list[str] = Field(default_factory=list)
    tasks: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    project_feature: str = ""
    resume_bullet_after_completion: str = ""
    interview_talking_point: str = ""


class RoadmapOutput(AIOutputBase):
    roadmap_summary: str = ""
    recommended_project_theme: str = ""
    weeks: list[RoadmapWeek] = Field(default_factory=list)
    success_criteria: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _exactly_four_weeks(self) -> "RoadmapOutput":
        if len(self.weeks) != 4 or {w.week for w in self.weeks} != {1, 2, 3, 4}:
            raise ValueError("Roadmap must contain exactly weeks 1, 2, 3, and 4.")
        return self
