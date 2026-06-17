"""AI Role Relevance classifier workflow (US-072, Period 16).

Classifies a saved job for AI engineering relevance — a judgment about the job
itself, separate from candidate fit (Principle 2). Runs on the standard US-027
foundation: ``ai_workflow_runs`` records the run; the output snapshot is the
persistent store (no separate domain table). US-067 reuse applies: unchanged job
text re-serves the saved result with zero model calls.

The deterministic keyword pre-filter (``ai_role_relevance_prefilter.py``) runs
before the prompt is built, grounding the model with detected AI keywords and
saving a model call when the job is clearly not AI-related.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas.ai_role_relevance import AiRoleRelevanceOutput
from app.schemas.ai_workflow import WorkflowStatus
from app.services.ai.ai_role_relevance_deterministic import deterministic_ai_relevance
from app.services.ai.ai_role_relevance_prefilter import compute_prefilter_score
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import DEFAULT_MESSAGES, UnauthorizedError
from app.services.ai.prompting import with_preamble

_MAX_JD_CHARS = 8_000  # default tier — more context than quick match


@dataclass
class AiRoleRelevanceInput:
    job: dict[str, Any]
    pre: dict[str, Any]  # compute_prefilter_score result


class AiRoleRelevanceWorkflow(BaseAIWorkflow):
    workflow_type = "ai_role_relevance"
    subject_type = "job"

    @property
    def output_model(self) -> type[AiRoleRelevanceOutput]:
        return AiRoleRelevanceOutput

    def authorize(self, *, subject_id: str, user_profile_id: str) -> dict[str, Any]:
        job = self.data.get_job(job_id=subject_id, user_profile_id=user_profile_id)
        if not job:
            raise UnauthorizedError(DEFAULT_MESSAGES["unauthorized"])
        return {"job": job}

    def reuse_identity(self, context: dict[str, Any], data: Any) -> dict[str, Any]:
        # AI relevance is a property of the job text itself; reuse when the job
        # row is unchanged (id + updated_at as proxy for content, per US-067).
        job = context.get("job") or {}
        return {"job": f"{job.get('id')}:{job.get('updated_at')}"}

    def load_input(self, context: dict[str, Any]) -> AiRoleRelevanceInput:
        job = context["job"]
        pre = compute_prefilter_score(job)
        return AiRoleRelevanceInput(job=job, pre=pre)

    def build_prompt(self, data: AiRoleRelevanceInput) -> str:
        job = data.job
        pre = data.pre
        title = str(job.get("title") or "").strip()
        company = str(job.get("company") or "").strip()
        jd = str(job.get("raw_description") or "").strip()[:_MAX_JD_CHARS]
        detected = ", ".join(pre["keyword_hits"][:12]) or "(none)"

        task = f"""\
Task: Classify this job for AI engineering relevance.

Focus: Is this a meaningful AI engineering role for someone transitioning to an
Applied AI Engineer path? This assessment is about the job itself — NOT about
any specific candidate.

Return JSON with EXACTLY these fields:
{{
  "is_ai_related": true/false,
  "ai_relevance_score": 0-100,
  "ai_role_category": "<exact value from the list below>",
  "transition_friendliness": "high" | "medium" | "low",
  "research_heavy": true/false,
  "engineering_focused": true/false,
  "relevance_reason": "<one sentence — what makes it AI-related or not>",
  "detected_ai_keywords": ["keyword1", ...],
  "exclude_reason": null or "<exact value from the list below>",
  "confidence_score": 0.0-1.0
}}

ai_role_category values (use exactly one):
applied_ai_engineer | llm_engineer | generative_ai_engineer | ai_product_engineer |
ai_platform_engineer | backend_ai_engineer | fullstack_ai_engineer |
ml_engineer | ml_research | ai_adjacent_engineering | not_ai_engineering |
non_engineering_ai | unknown

transition_friendliness:
  high   = role closely matches the Applied AI Engineer path (<30% new tech to learn)
  medium = role is relevant but requires learning new AI tooling or workflows
  low    = role has major gaps or is research/theory-heavy

research_heavy: true if the role focuses on ML research, papers, or theory rather than
  building production software systems.

engineering_focused: true if the role primarily builds software (APIs, services, pipelines).

exclude_reason values (use null when is_ai_related is true):
not_ai_related | non_engineering_ai_role | research_heavy_role |
data_or_analytics_role | generic_software_role | insufficient_job_data

Scoring thresholds:
  >= 75 : Strong AI engineering role (LLM products, RAG, GenAI, agents, AI infra)
  60-74 : Possibly AI-related (engineering at an AI company, some AI context)
  < 60  : Not meaningfully AI-related for this path

Local pre-filter detected these AI keywords: {detected}

Job title: {title}
Company: {company}

Job description (may be truncated):
---
{jd}
---
"""
        return with_preamble(task)

    def deterministic_fallback(self, data: AiRoleRelevanceInput) -> dict:
        return deterministic_ai_relevance(data.job)

    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: AiRoleRelevanceOutput,
        provider_name: str,
        status: WorkflowStatus,
        context: dict[str, Any],
        data: AiRoleRelevanceInput,
    ) -> None:
        # No domain table. The result lives in ``ai_workflow_runs.output_snapshot_json``.
        # US-077 (Save flow) will mirror display fields onto the ``jobs`` row.
        return None

    def build_activity(
        self,
        *,
        status: WorkflowStatus,
        output: AiRoleRelevanceOutput | None,
        context: dict[str, Any],
    ) -> ActivitySpec:
        job = context.get("job") or {}
        related_job_id = str(job["id"]) if job.get("id") else None
        job_title = job.get("title") or "this role"

        if status == "failed" or output is None:
            return ActivitySpec(
                activity_type=f"{self.workflow_type}.failed",
                title=f"AI relevance check for {job_title} could not be completed.",
                importance="low",
                related_job_id=related_job_id,
            )

        label = "strong AI match" if output.ai_relevance_score >= 75 else (
            "possibly AI-related" if output.ai_relevance_score >= 60 else "low AI relevance"
        )
        return ActivitySpec(
            activity_type=f"{self.workflow_type}.{status}",
            title=f"AI relevance check for {job_title}: {label}.",
            importance="low",
            related_job_id=related_job_id,
        )
