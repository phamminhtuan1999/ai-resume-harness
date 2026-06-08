from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.candidate_profile import (
    CandidateProfile,
    CandidateProfileDraft,
    ProfileConfidence,
)
from app.services.candidate_profile_extractor import (
    CandidateProfileExtractionError,
    CandidateProfileServiceUnavailableError,
    _generate_with_retry,
    _is_temporary_provider_error,
)
from app.services.supabase_data import (
    SupabaseConfigurationError,
    SupabaseDataError,
    _build_profile_update_payload,
    _raise_for_supabase,
)


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _authenticate() -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )


def _candidate_profile() -> CandidateProfile:
    return CandidateProfile.model_validate(
        {
            "basic_info": {
                "full_name": "Avery Candidate",
                "email": "avery@example.com",
                "location": "Remote US",
                "current_title": "Senior Software Engineer",
                "years_of_experience": 7,
            },
            "professional_summary": {
                "resume_summary": "Builds AI-enabled product systems.",
                "primary_engineering_background": "Backend and AI product engineering",
                "seniority_level": "Senior",
            },
            "skills": {
                "programming_languages": ["Python", "TypeScript"],
                "backend": ["FastAPI", "Postgres"],
                "ai_ml": ["LLMs", "RAG"],
            },
            "work_experience": [
                {
                    "company": "Harness AI",
                    "title": "Senior Software Engineer",
                    "bullet_points": ["Built resume matching workflows."],
                    "detected_skills": ["Python", "FastAPI"],
                }
            ],
            "ai_metadata": {
                "primary_role_family": "AI Engineering",
                "seniority_level": "Senior",
                "strongest_skills": ["Python", "FastAPI"],
                "suggested_target_roles": ["Applied AI Engineer"],
            },
        }
    )


def _candidate_draft() -> CandidateProfileDraft:
    return CandidateProfileDraft(
        candidate_profile=_candidate_profile(),
        confidence=ProfileConfidence(overall=0.86, low_confidence_fields=["basic_info.phone"]),
    )


def test_candidate_profile_extract_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/resumes/resume_1/extract-profile")

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_candidate_profile_extract_reads_owned_resume_and_returns_draft(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate()
    calls: dict[str, object] = {}

    class FakeSupabaseDataClient:
        def __init__(self, _settings: object) -> None:
            pass

        def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, str]:
            calls["clerk_user_id"] = clerk_user_id
            return {"id": "profile_123"}

        def get_owned_resume(self, *, resume_id: str, user_profile_id: str) -> dict[str, str]:
            calls["resume_lookup"] = (resume_id, user_profile_id)
            return {"id": resume_id, "raw_text": "Avery Candidate resume text"}

    def fake_extract_candidate_profile_from_text(
        *,
        resume_text: str,
        settings: object,
    ) -> CandidateProfileDraft:
        calls["resume_text"] = resume_text
        calls["settings_seen"] = settings is not None
        return _candidate_draft()

    monkeypatch.setattr("app.routers.resumes.SupabaseDataClient", FakeSupabaseDataClient)
    monkeypatch.setattr(
        "app.routers.resumes.extract_candidate_profile_from_text",
        fake_extract_candidate_profile_from_text,
    )

    response = client.post("/api/resumes/resume_1/extract-profile")

    assert response.status_code == 200
    assert response.json()["resume_id"] == "resume_1"
    assert response.json()["candidate_profile"]["basic_info"]["full_name"] == "Avery Candidate"
    assert response.json()["confidence"]["overall"] == 0.86
    assert calls == {
        "clerk_user_id": "user_test",
        "resume_lookup": ("resume_1", "profile_123"),
        "resume_text": "Avery Candidate resume text",
        "settings_seen": True,
    }


def test_candidate_profile_extract_rejects_empty_resume_text(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate()

    class FakeSupabaseDataClient:
        def __init__(self, _settings: object) -> None:
            pass

        def get_profile_for_clerk_user(self, _clerk_user_id: str) -> dict[str, str]:
            return {"id": "profile_123"}

        def get_owned_resume(self, *, resume_id: str, user_profile_id: str) -> dict[str, str]:
            return {"id": resume_id, "raw_text": "  "}

    monkeypatch.setattr("app.routers.resumes.SupabaseDataClient", FakeSupabaseDataClient)

    response = client.post("/api/resumes/resume_1/extract-profile")

    assert response.status_code == 422
    assert response.json() == {"detail": "Resume has no extracted text."}


def test_candidate_profile_extract_returns_service_unavailable_for_model_outage(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate()

    class FakeSupabaseDataClient:
        def __init__(self, _settings: object) -> None:
            pass

        def get_profile_for_clerk_user(self, _clerk_user_id: str) -> dict[str, str]:
            return {"id": "profile_123"}

        def get_owned_resume(self, *, resume_id: str, user_profile_id: str) -> dict[str, str]:
            return {"id": resume_id, "raw_text": "Avery Candidate resume text"}

    def fake_extract_candidate_profile_from_text(
        *,
        resume_text: str,
        settings: object,
    ) -> CandidateProfileDraft:
        raise CandidateProfileServiceUnavailableError(
            "Gemini is temporarily unavailable. Try again later."
        )

    monkeypatch.setattr("app.routers.resumes.SupabaseDataClient", FakeSupabaseDataClient)
    monkeypatch.setattr(
        "app.routers.resumes.extract_candidate_profile_from_text",
        fake_extract_candidate_profile_from_text,
    )

    response = client.post("/api/resumes/resume_1/extract-profile")

    assert response.status_code == 503
    assert response.json() == {"detail": "Gemini is temporarily unavailable. Try again later."}


class _FakeModels:
    def __init__(self, behaviors: list[object]) -> None:
        self._behaviors = list(behaviors)
        self.calls = 0

    def generate_content(self, *, model: str, contents: str, config: object) -> object:
        self.calls += 1
        behavior = self._behaviors.pop(0)
        if isinstance(behavior, Exception):
            raise behavior
        return behavior


class _FakeClient:
    def __init__(self, behaviors: list[object]) -> None:
        self.models = _FakeModels(behaviors)


def _sdk_503() -> RuntimeError:
    return RuntimeError(
        "503 UNAVAILABLE. {'error': {'code': 503, 'message': 'high demand', "
        "'status': 'UNAVAILABLE'}}"
    )


def _record_sleeps(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    sleeps: list[float] = []
    monkeypatch.setattr(
        "app.services.candidate_profile_extractor.time.sleep", sleeps.append
    )
    return sleeps


def test_generate_with_retry_recovers_after_transient_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleeps = _record_sleeps(monkeypatch)
    client = _FakeClient([_sdk_503(), _sdk_503(), "RESPONSE"])

    result = _generate_with_retry(
        client=client,
        model="gemini-2.5-flash",
        contents="prompt",
        config=None,
        max_attempts=3,
        base_delay_seconds=0.5,
    )

    assert result == "RESPONSE"
    assert client.models.calls == 3
    assert sleeps == [0.5, 1.0]


def test_generate_with_retry_raises_service_unavailable_when_attempts_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleeps = _record_sleeps(monkeypatch)
    client = _FakeClient([_sdk_503(), _sdk_503(), _sdk_503()])

    with pytest.raises(CandidateProfileServiceUnavailableError):
        _generate_with_retry(
            client=client,
            model="gemini-2.5-flash",
            contents="prompt",
            config=None,
            max_attempts=3,
            base_delay_seconds=0.5,
        )

    assert client.models.calls == 3
    assert sleeps == [0.5, 1.0]


def test_generate_with_retry_does_not_retry_non_transient_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleeps = _record_sleeps(monkeypatch)
    client = _FakeClient([RuntimeError("400 INVALID_ARGUMENT bad schema")])

    with pytest.raises(CandidateProfileExtractionError):
        _generate_with_retry(
            client=client,
            model="gemini-2.5-flash",
            contents="prompt",
            config=None,
            max_attempts=3,
            base_delay_seconds=0.5,
        )

    assert client.models.calls == 1
    assert sleeps == []


def test_candidate_profile_temporary_provider_error_detects_sdk_503_text() -> None:
    assert _is_temporary_provider_error(
        RuntimeError(
            "503 UNAVAILABLE. {'error': {'code': 503, 'message': 'This model is currently "
            "experiencing high demand.', 'status': 'UNAVAILABLE'}}"
        )
    )


def test_raise_for_supabase_allows_success_status() -> None:
    _raise_for_supabase(httpx.Response(200))


def test_raise_for_supabase_treats_4xx_as_configuration_error() -> None:
    with pytest.raises(SupabaseConfigurationError):
        _raise_for_supabase(httpx.Response(401))


def test_raise_for_supabase_treats_5xx_as_transient_error() -> None:
    with pytest.raises(SupabaseDataError) as exc_info:
        _raise_for_supabase(httpx.Response(503))
    assert not isinstance(exc_info.value, SupabaseConfigurationError)


def test_candidate_profile_extract_returns_500_for_misconfigured_data_source(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate()

    class FakeSupabaseDataClient:
        def __init__(self, _settings: object) -> None:
            pass

        def get_profile_for_clerk_user(self, _clerk_user_id: str) -> dict[str, str]:
            raise SupabaseConfigurationError("Supabase request failed with status 401.")

    monkeypatch.setattr("app.routers.resumes.SupabaseDataClient", FakeSupabaseDataClient)

    response = client.post("/api/resumes/resume_1/extract-profile")

    assert response.status_code == 500
    assert response.json() == {"detail": "Profile data source is misconfigured."}


def test_candidate_profile_extract_returns_503_for_data_outage(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate()

    class FakeSupabaseDataClient:
        def __init__(self, _settings: object) -> None:
            pass

        def get_profile_for_clerk_user(self, _clerk_user_id: str) -> dict[str, str]:
            raise SupabaseDataError("Supabase request failed with status 503.")

    monkeypatch.setattr("app.routers.resumes.SupabaseDataClient", FakeSupabaseDataClient)

    response = client.post("/api/resumes/resume_1/extract-profile")

    assert response.status_code == 503
    assert response.json() == {"detail": "Profile data is unavailable."}


def test_candidate_profile_import_saves_reviewed_profile(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate()
    saved_payloads: list[dict[str, object]] = []

    class FakeSupabaseDataClient:
        def __init__(self, _settings: object) -> None:
            pass

        def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, str]:
            return {"id": f"profile_for_{clerk_user_id}"}

        def get_owned_resume(self, *, resume_id: str, user_profile_id: str) -> dict[str, str]:
            return {"id": resume_id, "raw_text": "Resume text"}

        def save_candidate_profile(
            self,
            *,
            user_profile_id: str,
            resume_id: str,
            candidate_profile: CandidateProfile,
            confidence: ProfileConfidence,
        ) -> dict[str, str]:
            saved_payloads.append(
                {
                    "user_profile_id": user_profile_id,
                    "resume_id": resume_id,
                    "candidate_profile": candidate_profile,
                    "confidence": confidence,
                }
            )
            return {
                "id": user_profile_id,
                "profile_source": "resume_import",
                "profile_source_resume_id": resume_id,
            }

    monkeypatch.setattr("app.routers.profile.SupabaseDataClient", FakeSupabaseDataClient)

    draft = _candidate_draft()
    response = client.post(
        "/api/profile/import-from-resume",
        json={
            "resume_id": "resume_1",
            "candidate_profile": draft.candidate_profile.model_dump(mode="json"),
            "confidence": draft.confidence.model_dump(mode="json"),
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "profile_id": "profile_for_user_test",
        "resume_id": "resume_1",
        "profile_source": "resume_import",
    }
    assert saved_payloads[0]["user_profile_id"] == "profile_for_user_test"
    assert saved_payloads[0]["resume_id"] == "resume_1"
    assert isinstance(saved_payloads[0]["candidate_profile"], CandidateProfile)


def test_candidate_profile_update_payload_maps_json_and_profile_summary_fields() -> None:
    payload = _build_profile_update_payload(
        candidate_profile=_candidate_profile(),
        confidence=ProfileConfidence(overall=0.86, low_confidence_fields=["basic_info.phone"]),
        resume_id="resume_1",
    )

    assert payload["profile_source"] == "resume_import"
    assert payload["profile_source_resume_id"] == "resume_1"
    assert payload["current_role"] == "Senior Software Engineer"
    assert payload["years_of_experience"] == 7
    assert payload["target_role"] == "Applied AI Engineer"
    assert payload["location_preference"] == "Remote US"
    assert payload["candidate_profile_json"]["basic_info"]["full_name"] == "Avery Candidate"
    assert payload["candidate_profile_confidence_json"]["overall"] == 0.86
    assert "Backend and AI product engineering" in payload["technical_background"]
    assert "updated_at" in payload
