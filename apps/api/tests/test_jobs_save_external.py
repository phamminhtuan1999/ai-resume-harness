"""US-077 — ``POST /api/jobs/save-external``.

The keystone save for the Add Job hub: search results, URL previews, and pasted
JDs all persist here. Covers source mapping, dedup (normalized URL + external
id), the AI relevance / quick-match mirror onto the jobs columns (decision
0026), and the ``job.saved`` activity event. The Supabase client is faked so no
network or live DB is touched.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app


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


def _ai_relevance(**overrides: object) -> dict:
    base = {
        "is_ai_related": True,
        "ai_relevance_score": 84,
        "ai_role_category": "applied_ai_engineer",
        "transition_friendliness": "high",
        "research_heavy": False,
        "engineering_focused": True,
        "relevance_reason": "Builds LLM products with RAG.",
        "detected_ai_keywords": ["llm", "rag"],
        "exclude_reason": None,
    }
    base.update(overrides)
    return base


def _quick_match(**overrides: object) -> dict:
    base = {
        "preview_match_score": 72,
        "match_label": "possible",
        "assistant_preview": "Strong Python overlap; light on production LLM work.",
        "recommended_action": "apply_with_improvements",
        "unavailable": False,
    }
    base.update(overrides)
    return base


def _search_payload(**overrides: object) -> dict:
    base = {
        "source": "discovered_api",
        "title": "Senior Applied AI Engineer",
        "company": "Acme AI",
        "location": "Remote US",
        "raw_description": "Build LLM products with RAG pipelines and agents on AWS.",
        "external_source": "adzuna",
        "external_job_id": "adzuna-99",
        "external_apply_url": "https://acme.com/apply/99",
        "required_skills": ["Python", "RAG"],
        "extraction_confidence": 0.0,
        "ai_relevance": _ai_relevance(),
        "quick_match": _quick_match(),
    }
    base.update(overrides)
    return base


class _FakeSupabase:
    """Captures inserted jobs + activities; optional pre-existing dedup hits."""

    def __init__(
        self,
        _settings: object,
        *,
        by_url: dict | None = None,
        by_external: dict | None = None,
    ) -> None:
        self._by_url = by_url
        self._by_external = by_external
        self.inserted_jobs: list[dict] = []
        self.activities: list[dict] = []

    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, str]:
        return {"id": "profile_123"}

    def find_job_by_normalized_url(
        self, *, user_profile_id: str, normalized_url: str
    ) -> dict | None:
        return self._by_url

    def find_job_by_external_id(
        self, *, user_profile_id: str, external_source: str, external_job_id: str
    ) -> dict | None:
        return self._by_external

    def insert_job(self, *, user_profile_id: str, job: dict) -> dict:
        self.inserted_jobs.append(job)
        return {"id": "job_new_1"}

    def insert_activity(self, **kwargs: object) -> None:
        self.activities.append(kwargs)


def _install(monkeypatch: pytest.MonkeyPatch, fake: _FakeSupabase) -> _FakeSupabase:
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: fake)
    return fake


# --- auth ------------------------------------------------------------------------


def test_save_external_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/jobs/save-external", json=_search_payload())
    assert response.status_code == 401


# --- save from each intake source ------------------------------------------------


def test_save_search_result_persists_source_external_and_ai_columns(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(monkeypatch, _FakeSupabase(None))

    response = client.post("/api/jobs/save-external", json=_search_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["duplicate"] is False
    assert body["job_id"] == "job_new_1"

    row = fake.inserted_jobs[0]
    assert row["source"] == "discovered_api"
    assert row["external_source"] == "adzuna"
    assert row["external_job_id"] == "adzuna-99"
    assert row["external_apply_url"] == "https://acme.com/apply/99"
    # AI relevance mirror (decision 0026); label derived from the score band.
    assert row["ai_relevance_score"] == 84
    assert row["ai_relevance_label"] == "strong"
    assert row["transition_friendliness"] == "high"
    assert row["ai_relevance_json"]["is_ai_related"] is True
    # Quick match mirror — kept distinct from AI relevance.
    assert row["quick_match_score"] == 72
    assert row["quick_match_label"] == "possible"
    assert row["quick_match_json"]["recommended_action"] == "apply_with_improvements"


def test_save_paste_result_maps_source_and_omits_external_identity(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(monkeypatch, _FakeSupabase(None))

    payload = {
        "source": "manual_paste",
        "title": "AI Engineer",
        "company": "Northstar",
        "raw_description": "Ship retrieval-augmented features.",
        "ai_relevance": _ai_relevance(ai_relevance_score=66),
    }
    response = client.post("/api/jobs/save-external", json=payload)

    assert response.status_code == 200
    row = fake.inserted_jobs[0]
    assert row["source"] == "manual_paste"
    assert row.get("external_source") is None
    assert row["ai_relevance_label"] == "possible"  # 60–74 band
    # No quick match was supplied (paste preview does not run it).
    assert "quick_match_score" not in row


def test_save_url_result_carries_normalized_url(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(monkeypatch, _FakeSupabase(None))

    payload = {
        "source": "manual_url",
        "title": "LLM Engineer",
        "company": "Acme",
        "raw_description": "Own the inference stack.",
        "source_url": "https://acme.com/jobs/5?utm=li",
        "normalized_url": "https://acme.com/jobs/5",
        "ai_relevance": _ai_relevance(ai_relevance_score=50),
    }
    response = client.post("/api/jobs/save-external", json=payload)

    assert response.status_code == 200
    row = fake.inserted_jobs[0]
    assert row["source"] == "manual_url"
    assert row["normalized_url"] == "https://acme.com/jobs/5"
    assert row["ai_relevance_label"] == "hidden"  # <60 band


# --- dedup -----------------------------------------------------------------------


def test_save_dedups_by_normalized_url(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(
        monkeypatch,
        _FakeSupabase(None, by_url={"id": "job_existing_3", "title": "Saved role"}),
    )

    payload = {
        "source": "manual_url",
        "title": "LLM Engineer",
        "company": "Acme",
        "raw_description": "Own the inference stack.",
        "normalized_url": "https://acme.com/jobs/5",
    }
    response = client.post("/api/jobs/save-external", json=payload)

    body = response.json()
    assert body["duplicate"] is True
    assert body["job_id"] == "job_existing_3"
    # A duplicate never inserts or writes an activity event.
    assert fake.inserted_jobs == []
    assert fake.activities == []


def test_save_dedups_by_external_id(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(
        monkeypatch,
        _FakeSupabase(None, by_external={"id": "job_existing_9"}),
    )

    response = client.post("/api/jobs/save-external", json=_search_payload())

    body = response.json()
    assert body["duplicate"] is True
    assert body["job_id"] == "job_existing_9"
    assert fake.inserted_jobs == []


# --- activity --------------------------------------------------------------------


def test_save_writes_job_saved_activity(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(monkeypatch, _FakeSupabase(None))

    client.post("/api/jobs/save-external", json=_search_payload())

    assert len(fake.activities) == 1
    activity = fake.activities[0]
    assert activity["activity_type"] == "job.saved"
    assert activity["related_job_id"] == "job_new_1"
    assert activity["importance"] == "medium"
    assert "Search AI Jobs" in activity["assistant_description"]


def test_save_coerces_blank_title_and_company(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _install(monkeypatch, _FakeSupabase(None))

    payload = {
        "source": "manual_paste",
        "title": "   ",
        "company": "",
        "raw_description": "A short role description.",
    }
    response = client.post("/api/jobs/save-external", json=payload)

    assert response.status_code == 200
    row = fake.inserted_jobs[0]
    # NOT NULL columns get safe placeholders rather than failing the insert.
    assert row["title"] == "Untitled role"
    assert row["company"] == "Unknown company"


def test_save_rejects_unknown_source(client: TestClient) -> None:
    _authenticate()
    response = client.post(
        "/api/jobs/save-external",
        json={"source": "linkedin_scrape", "title": "x", "raw_description": "y" * 20},
    )
    assert response.status_code == 422
