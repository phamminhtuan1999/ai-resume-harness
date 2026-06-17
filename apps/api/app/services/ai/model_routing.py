"""Task-based model routing (US-066, Period 15).

ApplyWise does not spend the same model on every AI task. Each task resolves to
a configured model **tier** — *fast* for short, low-stakes text, *default* for
analysis and generation, and *heavy* as an opt-in upgrade for Draft CV
generation only. Tiers are environment configuration; no feature service or
workflow names a concrete model. When a tier is unconfigured it falls back to
the default model, so existing single-model deployments behave identically with
no new env vars.

This module is the single source of the task -> tier policy. Both the
``BaseAIWorkflow`` (keyed by ``workflow_type``) and the standalone extractors
(job extraction, candidate profile extraction, bullet edit) resolve through
``resolve_model`` so the model is never read from ``settings.gemini_model``
directly anywhere a tier could apply.
"""

from __future__ import annotations

from typing import Literal

from app.settings import Settings

Tier = Literal["fast", "default", "heavy"]

# Task keys are the existing ``workflow_type`` values plus the standalone
# extractor task names. Anything absent resolves to the default tier, so a new
# workflow is safe-by-default until it is added here deliberately.
TASK_TIER: dict[str, Tier] = {
    # Fast: short, low-stakes text.
    "activity_description": "fast",
    "dashboard_summary": "fast",
    "assistant_insight": "fast",
    # US-068 lands the quick-match workflow; routing it here now keeps the
    # policy in one place when that story arrives.
    "quick_match": "fast",
    # US-072: AI Role Relevance classifier — default tier (richer context than
    # quick match, must handle edge cases in category assignment).
    "ai_role_relevance": "default",
    # Default: analysis and generation.
    "match_analysis": "default",
    "missing_skills": "default",
    "resume_suggestions": "default",
    "cover_letter": "default",
    "roadmap": "default",
    "interview_prep": "default",
    "job_extraction": "default",
    "candidate_profile_extraction": "default",
    "bullet_edit": "default",
    # Heavy: opt-in upgrade for Draft CV generation only. The live Draft CV
    # workflow is ``draft_cv``; ``resume_draft`` was the pre-US-059 name and is
    # retired (decision 0019) but kept here so the story's literal heavy task
    # name still resolves — no run of that type is produced anymore.
    "draft_cv": "heavy",
    "resume_draft": "heavy",
}


def resolve_tier(task: str) -> Tier:
    """The policy tier for a task. Unknown tasks fall back to ``default``."""
    return TASK_TIER.get(task, "default")


def resolve_model(task: str, settings: Settings) -> str:
    """Resolve the concrete model name for a task via its tier.

    - fast  -> ``GEMINI_FAST_MODEL`` if set, else the default model.
    - default -> ``GEMINI_MODEL`` (unchanged meaning).
    - heavy -> ``GEMINI_HEAVY_MODEL`` only when both
      ``AI_USE_HEAVY_MODEL_FOR_DRAFT_CV`` is enabled and a heavy model is
      configured; otherwise the default model.
    """
    tier = resolve_tier(task)
    if tier == "fast":
        return settings.gemini_fast_model or settings.gemini_model
    if tier == "heavy":
        if settings.ai_use_heavy_model_for_draft_cv and settings.gemini_heavy_model:
            return settings.gemini_heavy_model
        return settings.gemini_model
    return settings.gemini_model
