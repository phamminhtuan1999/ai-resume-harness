from datetime import UTC, datetime
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
