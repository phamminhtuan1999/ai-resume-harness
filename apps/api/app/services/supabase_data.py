from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.schemas.candidate_profile import CandidateProfile, ProfileConfidence
from app.settings import Settings


class SupabaseDataError(RuntimeError):
    """Transient/upstream failure talking to Supabase (network or 5xx). Maps to 503."""


class SupabaseConfigurationError(SupabaseDataError):
    """Supabase rejected the request (4xx): bad credentials, query, or schema.

    This is a server-side configuration or code bug, not a temporary outage, so
    routers should surface it as a 500 rather than masking it as a 503.
    """


class SupabaseDataClient:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise SupabaseConfigurationError("Supabase is not configured.")

        self.base_url = settings.supabase_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
        extra_headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        headers = self.headers if extra_headers is None else {**self.headers, **extra_headers}
        try:
            response = httpx.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                params=params,
                json=json,
                timeout=20,
            )
        except httpx.HTTPError as exc:
            raise SupabaseDataError("Supabase request could not be completed.") from exc

        _raise_for_supabase(response)
        return response

    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/user_profiles",
            params={
                "select": (
                    "id,current_role,years_of_experience,target_role,"
                    "location_preference,technical_background"
                ),
                "clerk_user_id": f"eq.{clerk_user_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def get_owned_resume(self, *, resume_id: str, user_profile_id: str) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/resumes",
            params={
                "select": "id,title,raw_text",
                "id": f"eq.{resume_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def find_job_by_normalized_url(
        self, *, user_profile_id: str, normalized_url: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/jobs",
            params={
                "select": "id,company,title,source_url,normalized_url",
                "user_id": f"eq.{user_profile_id}",
                "normalized_url": f"eq.{normalized_url}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def insert_job(self, *, user_profile_id: str, job: dict[str, Any]) -> dict[str, Any]:
        response = self._request(
            "POST",
            "/jobs",
            params={"select": "id"},
            json={**job, "user_id": user_profile_id},
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Job insert returned no rows.")
        return rows[0]

    def update_job_extraction(
        self, *, job_id: str, user_profile_id: str, fields: dict[str, Any]
    ) -> None:
        """Write refreshed job-requirement extraction onto an owned job (US-050).

        Deliberately does NOT bump ``updated_at``: extraction is enrichment of an
        unchanged job, not a job edit, so it must not re-trip decision staleness.
        """
        self._request(
            "PATCH",
            "/jobs",
            params={"id": f"eq.{job_id}", "user_id": f"eq.{user_profile_id}"},
            json=fields,
        )

    def save_candidate_profile(
        self,
        *,
        user_profile_id: str,
        resume_id: str,
        candidate_profile: CandidateProfile,
        confidence: ProfileConfidence,
    ) -> dict[str, Any]:
        payload = _build_profile_update_payload(
            candidate_profile=candidate_profile,
            confidence=confidence,
            resume_id=resume_id,
        )
        response = self._request(
            "PATCH",
            "/user_profiles",
            params={
                "id": f"eq.{user_profile_id}",
                "select": "id,profile_source,profile_source_resume_id",
            },
            json=payload,
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Profile save returned no rows.")
        return rows[0]

    # --- Period 8 AI workflow foundation (US-027) --------------------------------

    def get_match_with_resume_and_job(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        """Load an owned match plus its resume and job in one bundle.

        Returns ``None`` when the match does not exist or is not owned by the
        user, which the workflow surfaces as ``unauthorized`` before any run row
        is written. Resume/job may be ``None`` if a referenced row was deleted.
        """
        response = self._request(
            "GET",
            "/matches",
            params={
                # Extra columns past the original (scores, timestamps, evidence
                # blobs) feed the US-047 analysis package; workflows that only
                # need id/resume_id/job_id simply ignore them.
                "select": (
                    "id,resume_id,job_id,overall_score,skill_score,experience_score,"
                    "ai_readiness_score,ats_keyword_score,seniority_score,"
                    "analyzer_provider,apply_recommendation,confidence_score,"
                    "analyzed_at,updated_at,assistant_summary,fit_reasoning,"
                    "top_strengths_json,top_gaps_json,risks_json"
                ),
                "id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        if not rows:
            return None
        match = rows[0]

        resume = self._get_owned_row(
            table="resumes",
            select="id,title,raw_text,structured_json,updated_at",
            row_id=match.get("resume_id"),
            user_profile_id=user_profile_id,
        )
        job = self._get_owned_row(
            table="jobs",
            select=(
                "id,company,title,location,work_type,raw_description,"
                "structured_json,parse_status,job_url,updated_at,"
                "extraction_status,extraction_json"
            ),
            row_id=match.get("job_id"),
            user_profile_id=user_profile_id,
        )
        return {"match": match, "resume": resume, "job": job}

    def _get_owned_row(
        self, *, table: str, select: str, row_id: Any, user_profile_id: str
    ) -> dict[str, Any] | None:
        if not row_id:
            return None
        response = self._request(
            "GET",
            f"/{table}",
            params={
                "select": select,
                "id": f"eq.{row_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def get_candidate_profile(self, *, user_profile_id: str) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/user_profiles",
            params={
                "select": (
                    "id,current_role,years_of_experience,target_role,"
                    "location_preference,technical_background,phone,contact_email,"
                    "candidate_profile_json,updated_at"
                ),
                "id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def insert_workflow_run(
        self,
        *,
        user_profile_id: str,
        workflow_type: str,
        subject_type: str,
        subject_id: str | None,
    ) -> dict[str, Any]:
        response = self._request(
            "POST",
            "/ai_workflow_runs",
            params={"select": "id"},
            json={
                "user_id": user_profile_id,
                "workflow_type": workflow_type,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "status": "queued",
            },
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Workflow run insert returned no rows.")
        return rows[0]

    def update_workflow_run(self, *, run_id: str, **fields: Any) -> None:
        payload = {**fields, "updated_at": datetime.now(UTC).isoformat()}
        self._request(
            "PATCH",
            "/ai_workflow_runs",
            params={"id": f"eq.{run_id}"},
            json=payload,
        )

    # Activity events past this window are pruned opportunistically on write,
    # so the feed cannot grow unbounded (US-037 retention decision).
    ACTIVITY_RETENTION_DAYS = 90

    def insert_activity(
        self,
        *,
        user_profile_id: str,
        workflow_run_id: str | None,
        activity_type: str,
        title: str,
        importance: str = "low",
        related_job_id: str | None = None,
        related_match_id: str | None = None,
        assistant_description: str | None = None,
    ) -> None:
        self._request(
            "POST",
            "/activity_feed",
            json={
                "user_id": user_profile_id,
                "workflow_run_id": workflow_run_id,
                "activity_type": activity_type,
                "title": title,
                "importance": importance,
                "related_job_id": related_job_id,
                "related_match_id": related_match_id,
                "assistant_description": assistant_description,
            },
        )

        cutoff = (
            datetime.now(UTC) - timedelta(days=self.ACTIVITY_RETENTION_DAYS)
        ).isoformat()
        self._request(
            "DELETE",
            "/activity_feed",
            params={
                "user_id": f"eq.{user_profile_id}",
                "created_at": f"lt.{cutoff}",
            },
        )

    def get_latest_runs_for_match(
        self, *, match_id: str, user_profile_id: str
    ) -> list[dict[str, Any]]:
        """Latest run per ``workflow_type`` for a match (drives the US-038 panel)."""
        response = self._request(
            "GET",
            "/ai_workflow_runs",
            params={
                "select": (
                    "workflow_type,status,model_provider,model_name,confidence_score,"
                    "completed_at,created_at,output_snapshot_json,error_code,"
                    "error_message"
                ),
                "user_id": f"eq.{user_profile_id}",
                "subject_type": "eq.match",
                "subject_id": f"eq.{match_id}",
                "order": "created_at.desc",
            },
        )
        latest: dict[str, dict[str, Any]] = {}
        for row in response.json():
            workflow_type = row.get("workflow_type")
            if workflow_type and workflow_type not in latest:
                latest[workflow_type] = row
        return list(latest.values())

    def get_latest_workflow_run(
        self, *, match_id: str, user_profile_id: str, workflow_type: str
    ) -> dict[str, Any] | None:
        """Latest run of one ``workflow_type`` for a match, with its snapshot.

        Used by the per-feature GET endpoints (US-031+) that re-render persisted
        output (strategy/keywords/draft) without re-calling the model.
        """
        response = self._request(
            "GET",
            "/ai_workflow_runs",
            params={
                "select": (
                    "id,workflow_type,status,model_provider,model_name,latency_ms,"
                    "confidence_score,error_code,error_message,output_snapshot_json,"
                    "completed_at,created_at"
                ),
                "user_id": f"eq.{user_profile_id}",
                "subject_type": "eq.match",
                "subject_id": f"eq.{match_id}",
                "workflow_type": f"eq.{workflow_type}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def get_saved_match_analysis(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        """Read a match's saved AI analysis columns (None if not owned)."""
        response = self._request(
            "GET",
            "/matches",
            params={
                "select": (
                    "id,overall_score,skill_score,experience_score,"
                    "ai_readiness_score,ats_keyword_score,seniority_score,"
                    "location_score,seniority_match_label,apply_recommendation,"
                    "assistant_summary,fit_reasoning,score_explanations_json,"
                    "top_strengths_json,top_gaps_json,risks_json,next_best_action,"
                    "confidence_score,analyzer_provider"
                ),
                "id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def save_match_analysis(
        self, *, match_id: str, user_profile_id: str, analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Persist an AI match analysis onto the owned ``matches`` row (US-028)."""
        now = datetime.now(UTC).isoformat()
        # analyzed_at stamps when this analysis was generated, for staleness
        # detection against resume/job updated_at (Option A freshness).
        payload = {**analysis, "updated_at": now, "analyzed_at": now}
        response = self._request(
            "PATCH",
            "/matches",
            params={
                "id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "select": "id",
            },
            json=payload,
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Match analysis save returned no rows.")
        return rows[0]

    # --- Missing skill analysis (US-029) -----------------------------------------

    def get_missing_skill_analysis(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/missing_skill_analyses",
            params={
                "select": (
                    "id,match_id,summary,missing_skills_json,top_3_priority_gaps_json,"
                    "confidence_score,provider,updated_at"
                ),
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def save_missing_skill_analysis(
        self, *, match_id: str, user_profile_id: str, analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Upsert one missing-skill analysis per match (replace on regenerate)."""
        return self._upsert_by_match(
            table="missing_skill_analyses",
            match_id=match_id,
            user_profile_id=user_profile_id,
            payload=analysis,
        )

    # --- Job assistant insight (US-030) ------------------------------------------

    def get_assistant_insight(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/assistant_insights",
            params={
                "select": (
                    "id,match_id,assistant_summary,recommendation,"
                    "why_this_recommendation,next_best_action,application_strategy,"
                    "risk_level,confidence_score,provider,updated_at"
                ),
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def save_assistant_insight(
        self, *, match_id: str, user_profile_id: str, insight: dict[str, Any]
    ) -> dict[str, Any]:
        """Upsert one assistant insight per match (replace on regenerate)."""
        return self._upsert_by_match(
            table="assistant_insights",
            match_id=match_id,
            user_profile_id=user_profile_id,
            payload=insight,
        )

    # --- Resume suggestions (US-031) ---------------------------------------------

    def get_resume_suggestions_for_match(
        self, *, match_id: str, user_profile_id: str
    ) -> list[dict[str, Any]]:
        """Return a match's saved suggestion rows in stable creation order.

        Ownership is enforced by joining through ``matches.user_id`` so a row is
        only returned when the requesting user owns the parent match.
        """
        response = self._request(
            "GET",
            "/resume_suggestions",
            params={
                "select": (
                    "id,match_id,original_text,suggested_text,suggestion_type,"
                    "related_job_requirement,evidence,truth_guard_status,reason,"
                    "user_action,created_at,updated_at,matches!inner(user_id)"
                ),
                "match_id": f"eq.{match_id}",
                "matches.user_id": f"eq.{user_profile_id}",
                "order": "created_at.asc",
            },
        )
        rows = response.json()
        for row in rows:
            row.pop("matches", None)
        return rows

    def upsert_resume_suggestions(
        self, *, match_id: str, suggestions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Replace a match's suggestion rows: delete existing, then bulk insert.

        Ownership is enforced upstream (the workflow authorizes the match before
        persist). Regenerate reuses this, so prior Accept/Reject decisions are
        intentionally reset.
        """
        self._request(
            "DELETE",
            "/resume_suggestions",
            params={"match_id": f"eq.{match_id}"},
        )
        if not suggestions:
            return []
        now = datetime.now(UTC).isoformat()
        payload = [
            {**row, "match_id": match_id, "created_at": now, "updated_at": now}
            for row in suggestions
        ]
        response = self._request(
            "POST",
            "/resume_suggestions",
            params={"select": "id"},
            json=payload,
            extra_headers={"Prefer": "return=representation"},
        )
        return response.json()

    def patch_suggestion_user_action(
        self,
        *,
        suggestion_id: str,
        user_profile_id: str,
        user_action: str,
        suggested_text: str | None = None,
    ) -> dict[str, Any] | None:
        """Update one suggestion's ``user_action`` (and optionally its edited text).

        Ownership is asserted by first confirming the suggestion's parent match is
        owned by the user; returns ``None`` when it is not (router maps to 403).
        """
        owner = self._request(
            "GET",
            "/resume_suggestions",
            params={
                "select": "id,matches!inner(user_id)",
                "id": f"eq.{suggestion_id}",
                "matches.user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        if not owner.json():
            return None

        update: dict[str, Any] = {
            "user_action": user_action,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if suggested_text is not None:
            update["suggested_text"] = suggested_text
        response = self._request(
            "PATCH",
            "/resume_suggestions",
            params={
                "id": f"eq.{suggestion_id}",
                "select": (
                    "id,match_id,original_text,suggested_text,suggestion_type,"
                    "related_job_requirement,evidence,truth_guard_status,reason,"
                    "user_action,created_at,updated_at"
                ),
            },
            json=update,
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        return rows[0] if rows else None

    # --- Tailored resume draft (US-032) ------------------------------------------

    def insert_resume_version(
        self,
        *,
        user_profile_id: str,
        resume_id: str | None,
        job_id: str | None,
        match_id: str,
        title: str,
        content_markdown: str,
    ) -> dict[str, Any]:
        """Append a generated Markdown resume version for a match (history kept)."""
        now = datetime.now(UTC).isoformat()
        response = self._request(
            "POST",
            "/resume_versions",
            params={"select": "id"},
            json={
                "user_id": user_profile_id,
                "resume_id": resume_id,
                "job_id": job_id,
                "match_id": match_id,
                "title": title,
                "content_markdown": content_markdown,
                "created_at": now,
                "updated_at": now,
            },
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Resume version insert returned no rows.")
        return rows[0]

    def get_latest_resume_version(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/resume_versions",
            params={
                "select": "id,match_id,title,content_markdown,created_at,updated_at",
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    # --- Cover letter (US-033) ---------------------------------------------------

    def get_cover_letter(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/cover_letters",
            params={
                "select": (
                    "id,match_id,job_id,cover_letter,cover_letter_strategy,"
                    "key_points_json,claims_avoided_json,tone,confidence_score,"
                    "provider,updated_at"
                ),
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def save_cover_letter(
        self, *, match_id: str, user_profile_id: str, cover_letter: dict[str, Any]
    ) -> dict[str, Any]:
        """Upsert one cover letter per match (replace on regenerate)."""
        return self._upsert_by_match(
            table="cover_letters",
            match_id=match_id,
            user_profile_id=user_profile_id,
            payload=cover_letter,
        )

    # --- Roadmap (US-034) ---------------------------------------------------------

    def get_roadmap_for_match(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        """Latest saved roadmap for an owned match (None when absent/not owned)."""
        response = self._request(
            "GET",
            "/roadmaps",
            params={
                "select": "id,match_id,title,roadmap_json,created_at,updated_at",
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def upsert_roadmap(
        self,
        *,
        match_id: str,
        user_profile_id: str,
        title: str,
        roadmap_json: dict[str, Any],
    ) -> dict[str, Any]:
        """Replace the match's active roadmap (delete-then-insert).

        ``roadmaps`` has no unique constraint on ``match_id`` (Period 3 kept
        history), so the one-active-roadmap-per-match rule is enforced here.
        Ownership is asserted upstream by the workflow's ``authorize``.
        """
        self._request(
            "DELETE",
            "/roadmaps",
            params={"match_id": f"eq.{match_id}", "user_id": f"eq.{user_profile_id}"},
        )
        now = datetime.now(UTC).isoformat()
        response = self._request(
            "POST",
            "/roadmaps",
            params={"select": "id"},
            json={
                "user_id": user_profile_id,
                "match_id": match_id,
                "title": title,
                "roadmap_json": roadmap_json,
                "created_at": now,
                "updated_at": now,
            },
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Roadmap save returned no rows.")
        return rows[0]

    # --- Interview prep (US-035) ---------------------------------------------------

    def get_interview_prep_by_match(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        """Latest saved interview prep for an owned match (None when absent)."""
        response = self._request(
            "GET",
            "/interview_preps",
            params={
                "select": (
                    "id,match_id,questions_json,weak_topics_json,study_plan_json,"
                    "answer_guidance_json,created_at,updated_at"
                ),
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def upsert_interview_prep(
        self, *, match_id: str, user_profile_id: str, prep: dict[str, Any]
    ) -> dict[str, Any]:
        """Replace the match's interview prep (delete-then-insert).

        ``interview_preps`` has no unique constraint on ``match_id`` (Period 3
        kept history), so the one-active-prep-per-match rule is enforced here.
        Ownership is asserted upstream by the workflow's ``authorize``.
        """
        self._request(
            "DELETE",
            "/interview_preps",
            params={"match_id": f"eq.{match_id}", "user_id": f"eq.{user_profile_id}"},
        )
        now = datetime.now(UTC).isoformat()
        response = self._request(
            "POST",
            "/interview_preps",
            params={"select": "id"},
            json={
                **prep,
                "user_id": user_profile_id,
                "match_id": match_id,
                "created_at": now,
                "updated_at": now,
            },
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Interview prep save returned no rows.")
        return rows[0]

    # --- Dashboard AI summary (US-036) ---------------------------------------------

    def count_analyzed_jobs(self, *, user_profile_id: str) -> int:
        """Completed match/gap analysis runs for the §9 data gate (< 3 -> gate)."""
        response = self._request(
            "GET",
            "/ai_workflow_runs",
            params={
                "select": "id",
                "user_id": f"eq.{user_profile_id}",
                "workflow_type": "in.(match_analysis,missing_skills)",
                "status": "eq.completed",
            },
        )
        return len(response.json())

    def get_dashboard_summary_input(self, *, user_profile_id: str) -> dict[str, Any]:
        """Aggregate the §9.2 cross-job payload (no raw resume/JD text included)."""
        jobs = self._request(
            "GET",
            "/jobs",
            params={
                "select": "id,title,company,work_type,location",
                "user_id": f"eq.{user_profile_id}",
            },
        ).json()
        matches = self._request(
            "GET",
            "/matches",
            params={
                "select": "id,job_id,overall_score,apply_recommendation",
                "user_id": f"eq.{user_profile_id}",
                "overall_score": "not.is.null",
            },
        ).json()
        applications = self._request(
            "GET",
            "/applications",
            params={
                "select": "job_id,status",
                "user_id": f"eq.{user_profile_id}",
            },
        ).json()
        skills = self._request(
            "GET",
            "/missing_skill_analyses",
            params={
                "select": "match_id,missing_skills_json",
                "user_id": f"eq.{user_profile_id}",
            },
        ).json()
        activities = self._request(
            "GET",
            "/activity_feed",
            params={
                "select": "activity_type,title,importance,created_at",
                "user_id": f"eq.{user_profile_id}",
                "order": "created_at.desc",
                "limit": "30",
            },
        ).json()

        return {
            "candidate_profile": {},
            "jobs": jobs,
            "match_scores": [
                {"job_id": m.get("job_id"), "overall_score": m.get("overall_score")}
                for m in matches
            ],
            "application_statuses": applications,
            "missing_skills_across_jobs": [
                {
                    "match_id": row.get("match_id"),
                    "missing_skills": row.get("missing_skills_json") or [],
                }
                for row in skills
            ],
            "recent_activities": activities,
        }

    def get_dashboard_ai_summary(self, *, user_profile_id: str) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/dashboard_ai_summary",
            params={
                "select": (
                    "id,dashboard_summary,best_fit_roles_json,repeated_skill_gaps_json,"
                    "job_search_health,recommended_next_actions_json,confidence_score,"
                    "provider,updated_at"
                ),
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def upsert_dashboard_summary(
        self, *, user_profile_id: str, summary: dict[str, Any]
    ) -> dict[str, Any]:
        """One live summary per user (``ON CONFLICT (user_id) DO UPDATE``)."""
        response = self._request(
            "POST",
            "/dashboard_ai_summary",
            params={"on_conflict": "user_id", "select": "id"},
            json={
                **summary,
                "user_id": user_profile_id,
                "updated_at": datetime.now(UTC).isoformat(),
            },
            extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Dashboard summary save returned no rows.")
        return rows[0]

    def get_latest_run_for_user(
        self, *, user_profile_id: str, workflow_type: str
    ) -> dict[str, Any] | None:
        """Latest run of a user-scoped workflow (dashboard summary)."""
        response = self._request(
            "GET",
            "/ai_workflow_runs",
            params={
                "select": (
                    "id,workflow_type,status,model_provider,model_name,latency_ms,"
                    "confidence_score,error_code,error_message,completed_at,created_at"
                ),
                "user_id": f"eq.{user_profile_id}",
                "workflow_type": f"eq.{workflow_type}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    # --- AI workflow panel (US-038) -------------------------------------------------

    def flip_application_status_prepared(
        self, *, match_id: str, user_profile_id: str
    ) -> bool:
        """Mark the match's tracker row ``prepared`` after a full AI run.

        Returns True when a row was updated; False when no applications row
        exists for the match (the user has not saved it to the tracker) or it
        is already prepared.
        """
        response = self._request(
            "PATCH",
            "/applications",
            params={
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "status": "neq.prepared",
                "select": "id",
            },
            json={
                "status": "prepared",
                "updated_at": datetime.now(UTC).isoformat(),
            },
            extra_headers={"Prefer": "return=representation"},
        )
        return bool(response.json())

    # --- Activity feed (US-037) -----------------------------------------------------

    _ACTIVITY_SELECT = (
        "id,user_id,workflow_run_id,activity_type,title,assistant_description,"
        "importance,created_at,related_job_id,related_match_id,"
        "related_job:jobs(id,title,company)"
    )

    def list_activity_feed(
        self, *, user_profile_id: str, limit: int = 20, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int]:
        """Newest-first feed page plus the exact total (for pagination)."""
        response = self._request(
            "GET",
            "/activity_feed",
            params={
                "select": self._ACTIVITY_SELECT,
                "user_id": f"eq.{user_profile_id}",
                "order": "created_at.desc",
                "limit": str(limit),
                "offset": str(offset),
            },
            extra_headers={"Prefer": "count=exact"},
        )
        rows = response.json()
        content_range = response.headers.get("content-range") or ""
        total = len(rows)
        if "/" in content_range:
            try:
                total = int(content_range.split("/")[-1])
            except ValueError:
                pass
        return rows, total

    def get_activity(self, *, activity_id: str) -> dict[str, Any] | None:
        """One activity row with its joined job; the caller checks ownership."""
        response = self._request(
            "GET",
            "/activity_feed",
            params={
                "select": self._ACTIVITY_SELECT,
                "id": f"eq.{activity_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def get_workflow_run_snapshot(self, *, run_id: str) -> dict[str, Any] | None:
        if not run_id:
            return None
        response = self._request(
            "GET",
            "/ai_workflow_runs",
            params={
                "select": "id,workflow_type,status,confidence_score,output_snapshot_json",
                "id": f"eq.{run_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def update_activity_description(
        self,
        *,
        activity_id: str,
        user_profile_id: str,
        title: str,
        assistant_description: str | None,
        importance: str,
    ) -> dict[str, Any] | None:
        """Ownership-guarded update; returns the updated row or None."""
        response = self._request(
            "PATCH",
            "/activity_feed",
            params={
                "id": f"eq.{activity_id}",
                "user_id": f"eq.{user_profile_id}",
                "select": self._ACTIVITY_SELECT,
            },
            json={
                "title": title,
                "assistant_description": assistant_description,
                "importance": importance,
            },
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        return rows[0] if rows else None

    # --- Draft CV (US-039 / US-040 / US-041 / US-042) ----------------------------

    _DRAFT_CV_SELECT = (
        "id,user_id,match_id,job_id,resume_id,version,title,status,cv_json,"
        "cv_strategy_json,quality_notes_json,confidence_score,provider,model_name,"
        "last_exported_pdf_at,last_exported_docx_at,rendering_json,created_at,updated_at"
    )
    _DRAFT_CV_VERSION_SELECT = (
        "id,version,status,provider,confidence_score,created_at,updated_at"
    )

    def insert_draft_cv(
        self,
        *,
        user_profile_id: str,
        match_id: str,
        job_id: str | None,
        resume_id: str | None,
        title: str,
        status: str,
        cv_json: dict[str, Any],
        cv_strategy_json: dict[str, Any] | None,
        quality_notes_json: list[dict[str, Any]] | None,
        confidence_score: float | None,
        provider: str | None,
        model_name: str | None,
        rendering_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Append a new draft CV version for a match (history kept).

        The next ``version`` is computed from the current max for the match. The
        ``unique (match_id, version)`` constraint rejects a concurrent duplicate;
        the caller surfaces that as a retryable failure. Ownership is asserted
        upstream by the workflow's ``authorize``.
        """
        existing = self._request(
            "GET",
            "/draft_cvs",
            params={
                "select": "version",
                "match_id": f"eq.{match_id}",
                "order": "version.desc",
                "limit": "1",
            },
        ).json()
        next_version = (existing[0]["version"] + 1) if existing else 1

        now = datetime.now(UTC).isoformat()
        response = self._request(
            "POST",
            "/draft_cvs",
            params={"select": self._DRAFT_CV_SELECT},
            json={
                "user_id": user_profile_id,
                "match_id": match_id,
                "job_id": job_id,
                "resume_id": resume_id,
                "version": next_version,
                "title": title,
                "status": status,
                "cv_json": cv_json,
                "cv_strategy_json": cv_strategy_json,
                "quality_notes_json": quality_notes_json or [],
                "confidence_score": confidence_score,
                "provider": provider,
                "model_name": model_name,
                "rendering_json": rendering_json,
                "created_at": now,
                "updated_at": now,
            },
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Draft CV insert returned no rows.")
        return rows[0]

    def get_latest_draft_cv(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/draft_cvs",
            params={
                "select": self._DRAFT_CV_SELECT,
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "version.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def list_draft_cv_versions(
        self, *, match_id: str, user_profile_id: str
    ) -> list[dict[str, Any]]:
        response = self._request(
            "GET",
            "/draft_cvs",
            params={
                "select": self._DRAFT_CV_VERSION_SELECT,
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "version.desc",
            },
        )
        return response.json()

    def get_draft_cv_by_id(
        self, *, draft_cv_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/draft_cvs",
            params={
                "select": self._DRAFT_CV_SELECT,
                "id": f"eq.{draft_cv_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def update_draft_cv(
        self,
        *,
        draft_cv_id: str,
        user_profile_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Ownership-guarded update of one draft row (status, cv_json, export
        stamps). Returns the updated row or ``None`` when not owned."""
        response = self._request(
            "PATCH",
            "/draft_cvs",
            params={
                "id": f"eq.{draft_cv_id}",
                "user_id": f"eq.{user_profile_id}",
                "select": self._DRAFT_CV_SELECT,
            },
            json={**fields, "updated_at": datetime.now(UTC).isoformat()},
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        return rows[0] if rows else None

    def _upsert_by_match(
        self,
        *,
        table: str,
        match_id: str,
        user_profile_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Insert-or-replace a per-match analysis row, keyed by ``match_id``.

        Ownership is enforced upstream (the workflow authorizes the match before
        persist), so the unique ``match_id`` upsert is safe.
        """
        body = {
            **payload,
            "match_id": match_id,
            "user_id": user_profile_id,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        response = self._request(
            "POST",
            f"/{table}",
            params={"on_conflict": "match_id", "select": "id"},
            json=body,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError(f"{table} save returned no rows.")
        return rows[0]

    # --- Analysis package: applications + decision snapshots (US-047) ----------

    def get_application_for_match(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        """The tracker row for a match (status drives placement overrides, §4)."""
        response = self._request(
            "GET",
            "/applications",
            params={
                "select": "status,applied_date",
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def get_latest_decision_snapshot(
        self, *, match_id: str, user_profile_id: str
    ) -> dict[str, Any] | None:
        """Most recent decision snapshot for a match (the served verdict, §7)."""
        response = self._request(
            "GET",
            "/analysis_decisions",
            params={
                "select": (
                    "id,label,display_label,match_score,scores_json,risk_level,"
                    "confidence,confidence_reasons_json,summary,evidence_json,"
                    "inputs_snapshot_json,inputs_hash,rules_version,previous_label,"
                    "decided_at"
                ),
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "decided_at.desc",
                "limit": "1",
            },
        )
        rows = response.json()
        return rows[0] if rows else None

    def insert_decision_snapshot(
        self, *, user_profile_id: str, match_id: str, snapshot: dict[str, Any]
    ) -> dict[str, Any]:
        """Append one decision snapshot (the only writer of ``analysis_decisions``)."""
        response = self._request(
            "POST",
            "/analysis_decisions",
            params={"select": "id,label,previous_label,decided_at,inputs_hash"},
            json={**snapshot, "user_id": user_profile_id, "match_id": match_id},
            extra_headers={"Prefer": "return=representation"},
        )
        rows = response.json()
        if not rows:
            raise SupabaseDataError("Decision snapshot insert returned no rows.")
        return rows[0]

    def get_decision_history(
        self, *, match_id: str, user_profile_id: str, limit: int = 20
    ) -> tuple[list[dict[str, Any]], int]:
        """Decision snapshots newest-first plus the exact total (US-054).

        The total lets the history view show how many older runs were dropped
        beyond ``limit`` — a capped list never reads as the whole story.
        """
        response = self._request(
            "GET",
            "/analysis_decisions",
            params={
                "select": (
                    "id,label,display_label,match_score,scores_json,risk_level,"
                    "confidence,confidence_reasons_json,summary,inputs_snapshot_json,"
                    "rules_version,previous_label,decided_at"
                ),
                "match_id": f"eq.{match_id}",
                "user_id": f"eq.{user_profile_id}",
                "order": "decided_at.desc",
                "limit": str(limit),
            },
            extra_headers={"Prefer": "count=exact"},
        )
        rows = response.json()
        content_range = response.headers.get("content-range") or ""
        total = len(rows)
        if "/" in content_range:
            try:
                total = int(content_range.split("/")[-1])
            except ValueError:
                pass
        return rows, total


def _raise_for_supabase(response: httpx.Response) -> None:
    if response.status_code < 400:
        return

    detail = f"Supabase request failed with status {response.status_code}."
    if response.status_code < 500:
        # 4xx: bad credentials, malformed query, or missing column/table. These
        # are config/code bugs that retrying will not fix.
        raise SupabaseConfigurationError(detail)
    raise SupabaseDataError(detail)


def _build_profile_update_payload(
    *,
    candidate_profile: CandidateProfile,
    confidence: ProfileConfidence,
    resume_id: str,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "candidate_profile_json": candidate_profile.model_dump(mode="json"),
        "candidate_profile_confidence_json": confidence.model_dump(mode="json"),
        "profile_source": "resume_import",
        "profile_source_resume_id": resume_id,
        "updated_at": datetime.now(UTC).isoformat(),
    }

    basic = candidate_profile.basic_info
    summary = candidate_profile.professional_summary
    skills = candidate_profile.skills
    metadata = candidate_profile.ai_metadata

    if basic.current_title:
        payload["current_role"] = basic.current_title
    if basic.years_of_experience is not None:
        payload["years_of_experience"] = basic.years_of_experience
    if basic.location:
        payload["location_preference"] = basic.location

    target_role = _choose_target_role(metadata.suggested_target_roles)
    if target_role:
        payload["target_role"] = target_role

    technical_background = _technical_background(summary.primary_engineering_background, skills)
    if technical_background:
        payload["technical_background"] = technical_background

    return payload


def _choose_target_role(suggested_target_roles: list[str]) -> str | None:
    supported = {
        "AI Engineer",
        "Applied AI Engineer",
        "LLM Engineer",
        "GenAI Engineer",
        "ML Engineer",
    }
    for role in suggested_target_roles:
        if role in supported:
            return role
    return None


def _technical_background(primary_background: str | None, skills: Any) -> str | None:
    skill_values: list[str] = []
    for values in [
        skills.programming_languages,
        skills.backend,
        skills.frontend,
        skills.databases,
        skills.cloud_devops,
        skills.ai_ml,
        skills.testing,
        skills.accessibility,
        skills.tools,
    ]:
        skill_values.extend(values)

    unique_skills = list(dict.fromkeys(skill_values))
    parts = [part for part in [primary_background, ", ".join(unique_skills[:12])] if part]
    return " | ".join(parts) if parts else None
