"""Shared fakes for the Period 8 AI workflow tests (US-027 / US-028).

No live model calls: ``FakeGeminiClient`` returns canned structured responses and
canned failures, and ``FakeData`` is an in-memory stand-in for
``SupabaseDataClient`` that records every run/activity/persist call so tests can
assert the standard flow's side effects.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any


def make_settings(
    *,
    gemini_api_key: str = "",
    gemini_model: str = "gemini-2.5-flash",
    gemini_max_attempts: int = 3,
    gemini_retry_base_delay_seconds: float = 0.0,
) -> SimpleNamespace:
    return SimpleNamespace(
        gemini_api_key=gemini_api_key,
        gemini_model=gemini_model,
        gemini_max_attempts=gemini_max_attempts,
        gemini_retry_base_delay_seconds=gemini_retry_base_delay_seconds,
    )


def gemini_response(*, text: str | None = None, parsed: Any = None) -> SimpleNamespace:
    return SimpleNamespace(text=text, parsed=parsed)


def valid_analysis(**overrides: Any) -> dict:
    base = {
        "skill_score": 80,
        "experience_score": 70,
        "ai_readiness_score": 60,
        "ats_keyword_score": 75,
        "seniority_score": 65,
        "location_score": 50,
        "seniority_match_label": "senior vs senior",
        "apply_recommendation": "apply_now",
        "assistant_summary": "Strong overlap on backend and AI tooling.",
        "fit_reasoning": "Resume shows FastAPI and RAG work matching the role.",
        "score_explanations": {
            "skill": "Covers most listed skills.",
            "experience": "6 years vs 5 expected.",
            "ai_readiness": "RAG and embeddings present.",
            "ats_keyword": "Most keywords present.",
            "seniority": "Senior matches senior.",
        },
        "top_strengths": [
            {
                "strength": "FastAPI services",
                "resume_evidence": "Built FastAPI microservices for 3 years.",
                "job_requirement": "Build Python/FastAPI services.",
                "why_it_matters": "Directly matches the core stack.",
            }
        ],
        "top_gaps": [
            {
                "gap": "LangGraph",
                "gap_type": "true_gap",
                "job_requirement": "Orchestrate agents with LangGraph.",
                "why_it_matters": "Role centers on agent orchestration.",
                "suggested_action": "Build a small LangGraph project.",
            }
        ],
        "risks": ["May be screened out for missing LangGraph."],
        "next_best_action": "Add an agent-orchestration project.",
        "confidence_score": 0.82,
    }
    base.update(overrides)
    return base


def gemini_valid(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_analysis(**overrides)))


def gemini_invalid() -> SimpleNamespace:
    return gemini_response(text="Sorry, I cannot answer that as JSON.")


def gemini_503() -> RuntimeError:
    return RuntimeError("503 UNAVAILABLE the model is overloaded")


# --- US-029 missing skills + US-030 assistant insight fixtures ------------------


def saved_match_row(**overrides: Any) -> dict:
    """A saved US-028 match analysis row (what ``get_saved_match_analysis`` returns)."""
    base = {
        "id": "match_1",
        "overall_score": 63,
        "skill_score": 70,
        "experience_score": 60,
        "ai_readiness_score": 55,
        "ats_keyword_score": 65,
        "seniority_score": 60,
        "apply_recommendation": "apply_with_improvements",
        "assistant_summary": "Possible match with gaps.",
        "fit_reasoning": "Backend strengths, AI proof is limited.",
        "top_gaps_json": [
            {
                "gap": "RAG",
                "gap_type": "true_gap",
                "job_requirement": "Build RAG pipelines.",
                "why_it_matters": "Core to the role.",
                "suggested_action": "Build a small RAG demo.",
            },
            {
                "gap": "Embeddings",
                "gap_type": "true_gap",
                "job_requirement": "Use embeddings + a vector DB.",
                "why_it_matters": "Required for retrieval.",
                "suggested_action": "Index a corpus with pgvector.",
            },
            {
                "gap": "Kafka",
                "gap_type": "wording_gap",
                "job_requirement": "Event streaming experience.",
                "why_it_matters": "Mentioned as a plus.",
                "suggested_action": "Surface your queue work on the resume.",
            },
            {
                "gap": "Evaluation",
                "gap_type": "proof_gap",
                "job_requirement": "LLM evaluation experience.",
                "why_it_matters": "Quality matters at scale.",
                "suggested_action": "Document an eval harness you built.",
            },
        ],
        "next_best_action": "Tailor your resume and build one AI project.",
        "confidence_score": 0.8,
        "analyzer_provider": "gemini",
    }
    base.update(overrides)
    return base


def valid_missing_skills(**overrides: Any) -> dict:
    base = {
        "summary": "RAG and embeddings are the priority gaps for this role.",
        "missing_skills": [
            {
                "skill": "RAG",
                "importance": "critical",
                "gap_type": "true_gap",
                "evidence_status": "no_evidence",
                "resume_evidence": None,
                "job_requirement": "Build RAG pipelines.",
                "why_it_matters": "Central to the role.",
                "how_to_fix": "Build a small RAG project.",
                "suggested_project_task": "Index docs and answer questions over them.",
                "interview_risk": "Expect deep RAG design questions.",
            }
        ],
        "top_3_priority_gaps": ["RAG", "Embeddings"],
        "confidence_score": 0.81,
    }
    base.update(overrides)
    return base


def gemini_valid_missing_skills(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_missing_skills(**overrides)))


def valid_insight(**overrides: Any) -> dict:
    base = {
        "assistant_summary": "Tailor your resume before applying.",
        "recommendation": "apply_now",  # deliberately optimistic; postprocess overrides it
        "why_this_recommendation": "Backend strengths are relevant.",
        "next_best_action": "Apply right away.",  # postprocess overrides via routing
        "application_strategy": "Lead with production engineering, add an AI project only if real.",
        "risk_level": "low",  # postprocess overrides from score band
        "confidence_score": 0.78,
    }
    base.update(overrides)
    return base


def gemini_valid_insight(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_insight(**overrides)))


# --- US-031 resume suggestions fixtures -----------------------------------------


def valid_resume_suggestions(**overrides: Any) -> dict:
    base = {
        "resume_strategy": "Lead with backend API expertise; defer LLM-native claims.",
        "assistant_summary": (
            "You can safely emphasize FastAPI and production debugging. Do not claim "
            "RAG experience unless you have a real project to support it."
        ),
        "suggestions": [
            {
                "section": "experience",
                "original_text": "Built REST APIs with FastAPI.",
                "suggested_text": "Designed production FastAPI services with async background tasks.",
                "related_job_requirement": "Production API development",
                "reason": "Clear FastAPI experience; adds specificity without inventing facts.",
                "evidence": "Resume mentions FastAPI across two roles.",
                "truth_guard_status": "safe_to_use",
            },
            {
                "section": "skills",
                "original_text": None,
                "suggested_text": "Surface your event-queue work to show streaming familiarity.",
                "related_job_requirement": "Event streaming",
                "reason": "Likely provable from nearby work, but not stated yet.",
                "evidence": "Resume mentions background queues.",
                "truth_guard_status": "needs_confirmation",
            },
            {
                "section": "skills",
                "original_text": None,
                "suggested_text": "Do not claim RAG pipelines yet; build a real project first.",
                "related_job_requirement": "RAG pipelines",
                "reason": "No resume evidence for RAG.",
                "evidence": None,
                "truth_guard_status": "do_not_use_yet",
            },
        ],
        "keywords_to_include": [
            {"keyword": "FastAPI", "status": "supported", "evidence": "Used in two roles."},
            {"keyword": "RAG", "status": "unsupported", "evidence": None},
        ],
        "do_not_claim": ["RAG pipelines", "vector database design"],
        "confidence_score": 0.81,
    }
    base.update(overrides)
    return base


def gemini_valid_resume_suggestions(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_resume_suggestions(**overrides)))


# --- US-032 resume draft + US-033 cover letter fixtures -------------------------


def valid_resume_draft(**overrides: Any) -> dict:
    base = {
        "resume_markdown": "# Tailored Resume\n\nSenior Python engineer with FastAPI experience.",
        "tailoring_summary": "Emphasized backend strengths; excluded unsupported RAG claims.",
        "included_suggestions": ["Sharpen the FastAPI impact bullet."],
        "excluded_suggestions": [{"suggestion": "Claim RAG experience", "reason": "unsupported"}],
        "quality_notes": ["Markdown only; review before applying."],
        "confidence_score": 0.8,
    }
    base.update(overrides)
    return base


def gemini_valid_resume_draft(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_resume_draft(**overrides)))


def valid_cover_letter(**overrides: Any) -> dict:
    base = {
        "cover_letter": "Dear Acme AI Hiring Team,\n\nI am applying for the Senior AI Engineer role.",
        "cover_letter_strategy": "Lead with backend strengths; avoid unproven RAG claims.",
        "key_points_used": ["FastAPI", "Production debugging"],
        "claims_avoided": ["RAG", "Embeddings"],
        "tone": "professional",
        "confidence_score": 0.79,
    }
    base.update(overrides)
    return base


def gemini_valid_cover_letter(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_cover_letter(**overrides)))


class FakeGeminiModels:
    def __init__(self, behaviors: list[Any]) -> None:
        self._behaviors = list(behaviors)
        self.calls = 0

    def generate_content(self, *, model: str, contents: str, config: Any) -> Any:
        self.calls += 1
        behavior = self._behaviors.pop(0)
        if isinstance(behavior, Exception):
            raise behavior
        return behavior


class FakeGeminiClient:
    def __init__(self, behaviors: list[Any]) -> None:
        self.models = FakeGeminiModels(behaviors)


# Default fixture data for an owned match with a backend resume and an AI JD.
RESUME_SECRET = "SECRET_RESUME_BODY_zzz"
JD_SECRET = "SECRET_JD_BODY_qqq"


def default_resume() -> dict:
    return {
        "id": "resume_1",
        "title": "Backend Engineer Resume",
        "raw_text": (
            f"Senior Python engineer. {RESUME_SECRET}. Built FastAPI services, "
            "Postgres, AWS, Docker. 6 years of experience. Senior."
        ),
        "structured_json": None,
    }


def default_job() -> dict:
    return {
        "id": "job_1",
        "company": "Acme AI",
        "title": "Senior AI Engineer",
        "location": "Remote US",
        "work_type": "remote",
        "raw_description": (
            f"Senior AI Engineer. {JD_SECRET}. Requires Python, FastAPI, RAG, "
            "embeddings, LLM, AWS. 5+ years."
        ),
        "structured_json": None,
        "parse_status": "parsed",
    }


def default_profile() -> dict:
    return {
        "id": "profile_1",
        "current_role": "Senior Software Engineer",
        "years_of_experience": 6,
        "target_role": "AI Engineer",
        "location_preference": "Remote US",
        "technical_background": "Python, FastAPI, AWS",
        "candidate_profile_json": {"basic_info": {"current_title": "Senior SWE"}},
    }


class FakeData:
    """In-memory SupabaseDataClient stand-in that records side effects."""

    def __init__(
        self,
        *,
        match: dict | None = None,
        resume: dict | None = None,
        job: dict | None = None,
        profile: dict | None = None,
        owned: bool = True,
        latest_runs: list[dict] | None = None,
        saved_analysis_row: dict | None = None,
        missing_skills_row: dict | None = None,
        assistant_insight_row: dict | None = None,
        resume_suggestions_rows: list[dict] | None = None,
        latest_run: dict | None = None,
        suggestion_owner: bool = True,
    ) -> None:
        self._match = match if match is not None else {"id": "match_1"}
        self._resume = resume if resume is not None else default_resume()
        self._job = job if job is not None else default_job()
        self._profile = profile if profile is not None else default_profile()
        self._owned = owned
        self._latest_runs = latest_runs or []
        self._saved_analysis_row = saved_analysis_row
        self._missing_skills_row = missing_skills_row
        self._assistant_insight_row = assistant_insight_row
        self._resume_suggestions_rows = resume_suggestions_rows or []
        self._latest_run = latest_run
        self._suggestion_owner = suggestion_owner

        self.runs: list[dict] = []
        self.run_updates: list[tuple[str, dict]] = []
        self.activities: list[dict] = []
        self.saved_analysis: dict | None = None
        self.saved_missing_skills: dict | None = None
        self.saved_insight: dict | None = None
        self.upserted_suggestions: list[dict] | None = None
        self.upsert_calls = 0
        self.patched: dict | None = None
        self.saved_resume_version: dict | None = None
        self.saved_cover_letter: dict | None = None
        self._counter = 0

    # --- router helpers ---
    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict:
        return {"id": "profile_1"}

    # --- authorize / load_input ---
    def get_match_with_resume_and_job(self, *, match_id: str, user_profile_id: str):
        if not self._owned:
            return None
        return {"match": self._match, "resume": self._resume, "job": self._job}

    def get_candidate_profile(self, *, user_profile_id: str):
        return self._profile

    # --- run + activity writers ---
    def insert_workflow_run(self, *, user_profile_id, workflow_type, subject_type, subject_id):
        self._counter += 1
        run = {
            "id": f"run_{self._counter}",
            "user_id": user_profile_id,
            "workflow_type": workflow_type,
            "subject_type": subject_type,
            "subject_id": subject_id,
            "status": "queued",
        }
        self.runs.append(run)
        return run

    def update_workflow_run(self, *, run_id, **fields):
        self.run_updates.append((run_id, fields))

    def insert_activity(self, **kwargs):
        self.activities.append(kwargs)

    # --- match persistence / reads ---
    def save_match_analysis(self, *, match_id, user_profile_id, analysis):
        self.saved_analysis = analysis
        return {"id": match_id}

    def get_latest_runs_for_match(self, *, match_id, user_profile_id):
        return self._latest_runs

    def get_saved_match_analysis(self, *, match_id, user_profile_id):
        return self._saved_analysis_row

    # --- US-029 missing skills persistence / reads ---
    def save_missing_skill_analysis(self, *, match_id, user_profile_id, analysis):
        self.saved_missing_skills = analysis
        return {"id": match_id}

    def get_missing_skill_analysis(self, *, match_id, user_profile_id):
        return self._missing_skills_row

    # --- US-030 assistant insight persistence / reads ---
    def save_assistant_insight(self, *, match_id, user_profile_id, insight):
        self.saved_insight = insight
        return {"id": match_id}

    def get_assistant_insight(self, *, match_id, user_profile_id):
        return self._assistant_insight_row

    # --- US-031 resume suggestions persistence / reads ---
    def upsert_resume_suggestions(self, *, match_id, suggestions):
        self.upsert_calls += 1
        self.upserted_suggestions = suggestions
        return [{"id": f"sug_{i + 1}"} for i in range(len(suggestions))]

    def get_resume_suggestions_for_match(self, *, match_id, user_profile_id):
        return self._resume_suggestions_rows

    def patch_suggestion_user_action(
        self, *, suggestion_id, user_profile_id, user_action, suggested_text=None
    ):
        if not self._suggestion_owner:
            return None
        self.patched = {
            "suggestion_id": suggestion_id,
            "user_action": user_action,
            "suggested_text": suggested_text,
        }
        row = {"id": suggestion_id, "user_action": user_action}
        if suggested_text is not None:
            row["suggested_text"] = suggested_text
        return row

    # --- US-032 resume draft persistence ---
    def insert_resume_version(
        self, *, user_profile_id, resume_id, job_id, match_id, title, content_markdown
    ):
        self.saved_resume_version = {
            "resume_id": resume_id,
            "job_id": job_id,
            "match_id": match_id,
            "title": title,
            "content_markdown": content_markdown,
        }
        return {"id": "version_1"}

    def get_latest_resume_version(self, *, match_id, user_profile_id):
        return self.saved_resume_version

    # --- US-033 cover letter persistence ---
    def save_cover_letter(self, *, match_id, user_profile_id, cover_letter):
        self.saved_cover_letter = cover_letter
        return {"id": match_id}

    def get_cover_letter(self, *, match_id, user_profile_id):
        return self.saved_cover_letter

    # --- assertions helpers ---
    @property
    def last_status(self) -> str | None:
        for _run_id, fields in reversed(self.run_updates):
            if "status" in fields:
                return fields["status"]
        return None

    @property
    def final_update(self) -> dict:
        return self.run_updates[-1][1] if self.run_updates else {}
