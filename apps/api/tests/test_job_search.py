"""US-073: External AI job search provider + POST /api/jobs/search-ai.

Unit tests: normalizer (map, dedup, score, sort, cap) and Adzuna parser.
Integration tests: endpoint auth, provider factory, cost-safe cap, friendly
error envelopes for not-configured and provider-failure paths.

No live Adzuna key required — FakeJobSearchProvider drives all tests.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.services.job_search.adzuna_client import AdzunaJobSearchProvider
from app.services.job_search.normalizer import normalize_and_rank
from app.services.job_search.provider import (
    JobSearchNotConfiguredError,
    JobSearchProviderError,
    ProviderJob,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_job(
    external_id: str = "job-1",
    title: str = "Applied AI Engineer",
    description: str = "Build LLM-powered features with RAG, OpenAI, and vector databases.",
    **kwargs: Any,
) -> ProviderJob:
    return ProviderJob(
        external_id=external_id,
        external_source="adzuna",
        title=title,
        company=kwargs.get("company", "Example AI"),
        location=kwargs.get("location", "Remote US"),
        description=description,
        apply_url=kwargs.get("apply_url", "https://example.com/jobs/1"),
        posted_at=kwargs.get("posted_at", "2025-01-01T00:00:00Z"),
    )


def _make_settings(**overrides: Any) -> SimpleNamespace:
    base: dict[str, Any] = {
        "job_search_provider": "adzuna",
        "adzuna_app_id": "test-id",
        "adzuna_app_key": "test-key",
        "adzuna_api_base": "https://api.adzuna.com/v1/api",
        "adzuna_search_country": "us",
        "adzuna_timeout_seconds": 10,
        "job_search_fetch_limit": 50,
        "job_search_prefilter_limit": 20,
        "supabase_url": "",
        "supabase_service_role_key": "",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class _FakeProvider:
    def __init__(
        self,
        jobs: list[ProviderJob] | None = None,
        *,
        fail: bool = False,
        not_configured: bool = False,
    ) -> None:
        self._jobs = jobs or []
        self._fail = fail
        self._not_configured = not_configured
        self.call_count = 0
        self.last_call: dict[str, Any] = {}

    def search(
        self,
        *,
        query: str,
        location: str,
        remote_only: bool,
        results_per_page: int,
    ) -> list[ProviderJob]:
        self.call_count += 1
        self.last_call = {
            "query": query,
            "location": location,
            "remote_only": remote_only,
            "results_per_page": results_per_page,
        }
        if self._not_configured:
            raise JobSearchNotConfiguredError("Not configured.")
        if self._fail:
            raise JobSearchProviderError("Provider down.")
        return self._jobs[:results_per_page]


class _FakeSupabase:
    def __init__(self, _settings: object) -> None:
        pass

    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, str]:
        return {"id": "profile-123"}


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _auth() -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )


def _wire(monkeypatch: pytest.MonkeyPatch, provider: _FakeProvider) -> None:
    _auth()
    monkeypatch.setattr("app.routers.jobs.get_settings", lambda: _make_settings())
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(_s))
    monkeypatch.setattr("app.routers.jobs.build_job_search_provider", lambda _s: provider)


# ---------------------------------------------------------------------------
# Unit: normalizer
# ---------------------------------------------------------------------------


def test_normalizer_maps_provider_job_to_result_shape() -> None:
    jobs = [_make_job()]
    ranked, _ = normalize_and_rank(jobs, prefilter_limit=20)
    assert len(ranked) == 1
    r = ranked[0]
    assert r["external_job_id"] == "job-1"
    assert r["external_source"] == "adzuna"
    assert r["title"] == "Applied AI Engineer"
    assert r["company"] == "Example AI"
    assert r["location"] == "Remote US"
    assert "description" in r
    assert r["apply_url"] == "https://example.com/jobs/1"


def test_normalizer_deduplicates_by_external_id() -> None:
    jobs = [_make_job("j1"), _make_job("j1"), _make_job("j2")]
    ranked, _ = normalize_and_rank(jobs, prefilter_limit=20)
    ids = [r["external_job_id"] for r in ranked]
    assert ids.count("j1") == 1
    assert "j2" in ids


def test_normalizer_truncates_long_description() -> None:
    long_desc = "x" * 10_000
    jobs = [_make_job(description=long_desc)]
    ranked, _ = normalize_and_rank(jobs, prefilter_limit=20)
    assert len(ranked[0]["description"]) <= 4_000


def test_normalizer_sorts_ai_jobs_first() -> None:
    non_ai = _make_job("n1", title="Sales Manager", description="Manage enterprise sales pipeline.")
    ai_job = _make_job(
        "a1",
        title="LLM Engineer",
        description="Build RAG workflows with LangChain, OpenAI, and vector databases.",
    )
    ranked, _ = normalize_and_rank([non_ai, ai_job], prefilter_limit=20)
    assert ranked[0]["external_job_id"] == "a1"


def test_normalizer_caps_at_prefilter_limit() -> None:
    jobs = [_make_job(f"j{i}") for i in range(30)]
    ranked, _ = normalize_and_rank(jobs, prefilter_limit=5)
    assert len(ranked) <= 5


def test_normalizer_total_ai_related_is_pre_cap_count() -> None:
    ai_jobs = [
        _make_job(f"a{i}", description="Build LLM-powered RAG pipelines with OpenAI embeddings.")
        for i in range(10)
    ]
    non_ai = [_make_job(f"n{i}", title="Sales Rep", description="Enterprise sales quota.") for i in range(5)]
    ranked, total_ai = normalize_and_rank(ai_jobs + non_ai, prefilter_limit=3)
    # cap is 3 but there are 10 AI-related jobs — total should reflect pre-cap count
    assert total_ai == 10
    assert len(ranked) == 3


def test_normalizer_empty_input_returns_zero_counts() -> None:
    ranked, total_ai = normalize_and_rank([], prefilter_limit=20)
    assert ranked == []
    assert total_ai == 0


# ---------------------------------------------------------------------------
# Unit: Adzuna client parser
# ---------------------------------------------------------------------------


def test_adzuna_parse_maps_fields() -> None:
    settings = _make_settings(adzuna_app_id="id", adzuna_app_key="key")
    provider = AdzunaJobSearchProvider(settings)

    payload = {
        "results": [
            {
                "id": "az-123",
                "title": "Applied AI Engineer",
                "company": {"display_name": "Example AI"},
                "location": {"display_name": "Remote, US"},
                "description": "Build LLM products.",
                "redirect_url": "https://example.com/apply",
                "created": "2025-01-15T09:00:00Z",
            }
        ],
        "count": 1,
    }
    jobs = provider._parse(payload)
    assert len(jobs) == 1
    j = jobs[0]
    assert j.external_id == "az-123"
    assert j.title == "Applied AI Engineer"
    assert j.company == "Example AI"
    assert j.location == "Remote, US"
    assert j.apply_url == "https://example.com/apply"
    assert j.posted_at == "2025-01-15T09:00:00Z"
    assert j.external_source == "adzuna"


def test_adzuna_parse_skips_items_missing_id_or_title() -> None:
    settings = _make_settings()
    provider = AdzunaJobSearchProvider(settings)
    payload = {
        "results": [
            {"id": "", "title": "Good title"},
            {"id": "valid-id", "title": ""},
            {"id": "valid-id-2", "title": "Valid Job"},
        ]
    }
    jobs = provider._parse(payload)
    assert len(jobs) == 1
    assert jobs[0].external_id == "valid-id-2"


def test_adzuna_raises_not_configured_when_keys_absent() -> None:
    settings = _make_settings(adzuna_app_id="", adzuna_app_key="")
    provider = AdzunaJobSearchProvider(settings)
    with pytest.raises(JobSearchNotConfiguredError):
        provider.search(query="AI Engineer", location="Remote", remote_only=False, results_per_page=10)


def test_adzuna_raises_provider_error_on_http_failure() -> None:
    import httpx

    settings = _make_settings()

    def bad_get(*args: Any, **kwargs: Any) -> httpx.Response:
        raise httpx.ConnectError("unreachable")

    provider = AdzunaJobSearchProvider(settings, get=bad_get)
    with pytest.raises(JobSearchProviderError):
        provider.search(query="AI Engineer", location="Remote", remote_only=False, results_per_page=10)


def test_adzuna_raises_provider_error_on_4xx() -> None:
    import httpx

    settings = _make_settings()

    def four_xx(*args: Any, **kwargs: Any) -> httpx.Response:
        return httpx.Response(401, content=b"Unauthorized")

    provider = AdzunaJobSearchProvider(settings, get=four_xx)
    with pytest.raises(JobSearchProviderError, match="401"):
        provider.search(query="AI Engineer", location="Remote", remote_only=False, results_per_page=10)


# ---------------------------------------------------------------------------
# Integration: POST /api/jobs/search-ai
# ---------------------------------------------------------------------------


def test_search_ai_requires_authentication(client: TestClient) -> None:
    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 401


def test_search_ai_returns_normalized_results(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ai_job = _make_job(
        "az-1",
        title="LLM Engineer",
        description="Build RAG pipelines with LangChain, OpenAI, and vector databases.",
    )
    _wire(monkeypatch, _FakeProvider([ai_job]))

    resp = client.post("/api/jobs/search-ai", json={"target_role": "LLM Engineer", "location": "Remote US"})
    assert resp.status_code == 200
    body = resp.json()
    assert "search_session_id" in body
    assert body["total_provider_results"] == 1
    assert body["error"] is None
    assert len(body["jobs"]) == 1
    job = body["jobs"][0]
    assert job["external_job_id"] == "az-1"
    assert job["title"] == "LLM Engineer"
    assert job["likely_ai_related"] is True


def test_search_ai_not_configured_returns_friendly_envelope(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _wire(monkeypatch, _FakeProvider(not_configured=True))

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["jobs"] == []
    assert body["error"]["code"] == "search_not_configured"
    assert body["total_provider_results"] == 0


def test_search_ai_provider_failure_returns_friendly_envelope(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _wire(monkeypatch, _FakeProvider(fail=True))

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["jobs"] == []
    assert body["error"]["code"] == "search_unavailable"


def test_search_ai_enforces_prefilter_cap(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    jobs = [_make_job(f"j{i}", description="LLM RAG pipeline with OpenAI and vector DB.") for i in range(30)]
    _auth()
    monkeypatch.setattr(
        "app.routers.jobs.get_settings",
        lambda: _make_settings(job_search_prefilter_limit=5),
    )
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(_s))
    monkeypatch.setattr("app.routers.jobs.build_job_search_provider", lambda _s: _FakeProvider(jobs))

    resp = client.post("/api/jobs/search-ai", json={"target_role": "LLM Engineer"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["jobs"]) <= 5


def test_search_ai_passes_fetch_limit_to_provider(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    provider = _FakeProvider([_make_job()])
    _auth()
    monkeypatch.setattr(
        "app.routers.jobs.get_settings",
        lambda: _make_settings(job_search_fetch_limit=15),
    )
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(_s))
    monkeypatch.setattr("app.routers.jobs.build_job_search_provider", lambda _s: provider)

    client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert provider.last_call["results_per_page"] == 15


def test_search_ai_uses_default_filters(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    provider = _FakeProvider([_make_job()])
    _wire(monkeypatch, provider)

    # Omit filters — should use defaults (only_ai_related ON etc.)
    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 200


def test_search_ai_total_ai_related_reflects_pre_cap_count(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ai_desc = "Build LLM-powered RAG pipelines with OpenAI embeddings and LangChain."
    jobs = [_make_job(f"a{i}", description=ai_desc) for i in range(10)]
    jobs += [_make_job(f"n{i}", title="Sales Rep", description="Enterprise quota.") for i in range(5)]

    _auth()
    monkeypatch.setattr(
        "app.routers.jobs.get_settings",
        lambda: _make_settings(job_search_prefilter_limit=3),
    )
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(_s))
    monkeypatch.setattr("app.routers.jobs.build_job_search_provider", lambda _s: _FakeProvider(jobs))

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    body = resp.json()
    assert body["total_ai_related_results"] == 10
    assert len(body["jobs"]) == 3
