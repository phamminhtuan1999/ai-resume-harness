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


# --- US-034 roadmap fixtures ------------------------------------------------------


def saved_missing_skills_row(**overrides: Any) -> dict:
    """A saved US-029 row (what ``get_missing_skill_analysis`` returns)."""
    base = {
        "id": "msa_1",
        "match_id": "match_1",
        "summary": "RAG and embeddings are the priority gaps for this role.",
        "missing_skills_json": [
            {
                "skill": "RAG",
                "importance": "critical",
                "gap_type": "true_gap",
                "how_to_fix": "Build a small RAG project.",
            },
            {
                "skill": "Embeddings",
                "importance": "critical",
                "gap_type": "true_gap",
                "how_to_fix": "Index a corpus with pgvector.",
            },
            {
                "skill": "Kafka",
                "importance": "medium",
                "gap_type": "wording_gap",
                "how_to_fix": "Surface your queue work on the resume.",
            },
        ],
        "top_3_priority_gaps_json": ["RAG", "Embeddings", "Kafka"],
        "confidence_score": 0.81,
        "provider": "gemini",
    }
    base.update(overrides)
    return base


def _roadmap_week(week: int, skills: list[str], **overrides: Any) -> dict:
    base = {
        "week": week,
        "goal": f"Close the {skills[0]} gap with a working demo.",
        "skills_covered": skills,
        "tasks": [f"Build a small {skills[0]} example.", "Document the tradeoffs."],
        "deliverables": [f"Working {skills[0]} demo with tests."],
        "project_feature": f"{skills[0]} feature on the portfolio project.",
        "resume_bullet_after_completion": (
            f"Built a verified {skills[0]} capability into a portfolio project."
        ),
        "interview_talking_point": f"Can explain {skills[0]} design tradeoffs.",
    }
    base.update(overrides)
    return base


def valid_roadmap(**overrides: Any) -> dict:
    base = {
        "roadmap_summary": "Closes RAG, embeddings, and evaluation gaps in 4 weeks.",
        "recommended_project_theme": "Multi-document Q&A assistant with pgvector retrieval.",
        "weeks": [
            _roadmap_week(1, ["RAG"]),
            _roadmap_week(2, ["Embeddings"]),
            _roadmap_week(3, ["Evaluation"]),
            _roadmap_week(4, ["Deployment"]),
        ],
        "success_criteria": [
            "A public demo URL exists.",
            "The evaluation harness produces reproducible scores.",
        ],
        "confidence_score": 0.82,
    }
    base.update(overrides)
    return base


def gemini_valid_roadmap(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_roadmap(**overrides)))


def gemini_three_week_roadmap() -> SimpleNamespace:
    payload = valid_roadmap()
    payload["weeks"] = payload["weeks"][:3]
    return gemini_response(text=json.dumps(payload))


# --- US-035 interview prep fixtures -----------------------------------------------


def valid_interview_prep(**overrides: Any) -> dict:
    base = {
        "prep_summary": "Expect deep RAG and evaluation questions; lead with FastAPI.",
        "technical_questions": ["How have you used FastAPI in production?"],
        "ai_llm_questions": ["How would you design a RAG pipeline for matching?"],
        "system_design_questions": ["Design a scalable job-matching service."],
        "behavioral_questions": ["Tell me about learning a missing skill quickly."],
        "weak_topics_to_study": ["vector databases", "embeddings evaluation"],
        "answer_guidance": [
            {
                "question": "How have you used FastAPI in production?",
                "recommended_angle": "Lead with the production services you built.",
                "resume_evidence_to_use": "Built FastAPI services for 3 years.",
                "warning": None,
            },
            {
                "question": "What is your hands-on experience with vector databases?",
                "recommended_angle": "Be honest that proof is limited.",
                "resume_evidence_to_use": None,
                "warning": "No vector-DB evidence found. Build a pgvector prototype first.",
            },
        ],
        "confidence_score": 0.84,
    }
    base.update(overrides)
    return base


def gemini_valid_interview_prep(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_interview_prep(**overrides)))


# --- US-036 dashboard summary fixtures ---------------------------------------------


def dashboard_input_payload(**overrides: Any) -> dict:
    """The §9.2 aggregated payload ``get_dashboard_summary_input`` returns."""
    base = {
        "candidate_profile": {},
        "jobs": [
            {"id": "job_1", "title": "Senior AI Engineer", "company": "Acme AI"},
            {"id": "job_2", "title": "ML Platform Engineer", "company": "Beta"},
            {"id": "job_3", "title": "Research Scientist", "company": "Gamma"},
        ],
        "match_scores": [
            {"job_id": "job_1", "overall_score": 72},
            {"job_id": "job_2", "overall_score": 68},
            {"job_id": "job_3", "overall_score": 41},
        ],
        "application_statuses": [{"job_id": "job_1", "status": "preparing"}],
        "missing_skills_across_jobs": [
            {
                "match_id": "match_1",
                "missing_skills": [{"skill": "RAG"}, {"skill": "Embeddings"}],
            },
            {
                "match_id": "match_2",
                "missing_skills": [{"skill": "RAG"}, {"skill": "Kubernetes"}],
            },
        ],
        "recent_activities": [
            {"activity_type": "match_analysis.completed", "title": "Analyzed", "importance": "medium"}
        ],
    }
    base.update(overrides)
    return base


def valid_dashboard_summary(**overrides: Any) -> dict:
    base = {
        "dashboard_summary": "You match backend-heavy AI roles best; RAG keeps repeating.",
        "best_fit_roles": ["AI Engineer", "ML Platform Engineer"],
        "repeated_skill_gaps": ["RAG"],
        "job_search_health": "moderate",
        "recommended_next_actions": ["Build a RAG portfolio project."],
        "confidence_score": 0.78,
    }
    base.update(overrides)
    return base


def gemini_valid_dashboard_summary(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_dashboard_summary(**overrides)))


# --- US-037 activity feed fixtures --------------------------------------------------


def activity_row(**overrides: Any) -> dict:
    base = {
        "id": "act_1",
        "user_id": "profile_1",
        "workflow_run_id": "run_orig",
        "activity_type": "match_analysis.completed",
        "title": "Match Analysis — Senior AI Engineer",
        "assistant_description": "ApplyWise scored the role at 78%.",
        "importance": "high",
        "created_at": "2026-06-08T10:32:14Z",
        "related_job_id": "job_1",
        "related_match_id": "match_1",
        "related_job": {"id": "job_1", "title": "Senior AI Engineer", "company": "Acme AI"},
    }
    base.update(overrides)
    return base


def valid_activity_description(**overrides: Any) -> dict:
    base = {
        "activity_title": "Match Analysis — Senior AI Engineer",
        "assistant_description": (
            "ApplyWise scored the Senior AI Engineer role at 78%. Your backend "
            "experience is relevant, but the role expects stronger RAG depth."
        ),
        "importance": "high",
    }
    base.update(overrides)
    return base


def gemini_valid_activity_description(**overrides: Any) -> SimpleNamespace:
    return gemini_response(text=json.dumps(valid_activity_description(**overrides)))


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
        analyzed_jobs_count: int = 3,
        dashboard_input: dict | None = None,
        activity_rows: list[dict] | None = None,
        run_snapshot: dict | None = None,
        has_application: bool = True,
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
        self._analyzed_jobs_count = analyzed_jobs_count
        self._dashboard_input = dashboard_input or dashboard_input_payload()
        self._activity_rows = activity_rows if activity_rows is not None else []
        self._run_snapshot = run_snapshot
        self.activity_updates = 0
        self._has_application = has_application
        self.prepared_flips: list[str] = []

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
        self.saved_roadmap: dict | None = None
        self.saved_interview_prep: dict | None = None
        self.saved_dashboard_summary: dict | None = None
        self.dashboard_upserts = 0
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

    def get_latest_workflow_run(self, *, match_id, user_profile_id, workflow_type):
        return self._latest_run

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

    # --- US-034 roadmap persistence / reads ---
    def upsert_roadmap(self, *, match_id, user_profile_id, title, roadmap_json):
        self.saved_roadmap = {
            "match_id": match_id,
            "user_id": user_profile_id,
            "title": title,
            "roadmap_json": roadmap_json,
        }
        return {"id": "roadmap_1"}

    def get_roadmap_for_match(self, *, match_id, user_profile_id):
        return self.saved_roadmap

    # --- US-035 interview prep persistence / reads ---
    def upsert_interview_prep(self, *, match_id, user_profile_id, prep):
        self.saved_interview_prep = {
            "match_id": match_id,
            "user_id": user_profile_id,
            **prep,
        }
        return {"id": "prep_1"}

    def get_interview_prep_by_match(self, *, match_id, user_profile_id):
        return self.saved_interview_prep

    # --- US-036 dashboard summary persistence / reads ---
    def count_analyzed_jobs(self, *, user_profile_id):
        return self._analyzed_jobs_count

    def get_dashboard_summary_input(self, *, user_profile_id):
        return dict(self._dashboard_input)

    def get_dashboard_ai_summary(self, *, user_profile_id):
        return self.saved_dashboard_summary

    def upsert_dashboard_summary(self, *, user_profile_id, summary):
        self.dashboard_upserts += 1
        self.saved_dashboard_summary = {"user_id": user_profile_id, **summary}
        return {"id": "summary_1"}

    def get_latest_run_for_user(self, *, user_profile_id, workflow_type):
        return self._latest_run

    # --- US-038 panel orchestration ---
    def flip_application_status_prepared(self, *, match_id, user_profile_id):
        self.prepared_flips.append(match_id)
        return self._has_application

    # --- US-037 activity feed reads / updates ---
    def list_activity_feed(self, *, user_profile_id, limit=20, offset=0):
        rows = [r for r in self._activity_rows if r.get("user_id") == user_profile_id]
        return rows[offset : offset + limit], len(rows)

    def get_activity(self, *, activity_id):
        for row in self._activity_rows:
            if row.get("id") == activity_id:
                return row
        return None

    def get_workflow_run_snapshot(self, *, run_id):
        return self._run_snapshot

    def update_activity_description(
        self, *, activity_id, user_profile_id, title, assistant_description, importance
    ):
        for row in self._activity_rows:
            if row.get("id") == activity_id and row.get("user_id") == user_profile_id:
                row.update(
                    title=title,
                    assistant_description=assistant_description,
                    importance=importance,
                )
                self.activity_updates += 1
                return row
        return None

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
