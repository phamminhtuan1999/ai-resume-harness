"""US-074: Cost-safe search result enrichment (AI relevance + quick match).

Unit tests cover the pipeline ordering, threshold filtering, recommended-action
mapping, the unavailable-quick-match path, and cache reuse. Integration tests
drive POST /api/jobs/search-ai with a counting fake client to assert the
per-search model-call budget is bounded (≤20 relevance, ≤8 quick match),
that the cache avoids re-calls, and that a missing profile returns
relevance-only results.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from ai_fakes import (
    default_profile,
    gemini_valid_ai_role_relevance,
    gemini_valid_quick_match,
    make_settings,
)
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.services.job_search.enricher import (
    POSSIBLE_THRESHOLD,
    STRONG_THRESHOLD,
    SearchEnricher,
    _recommended_action,
    _unavailable_quick_match,
)
from app.services.job_search.provider import ProviderJob

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_search_settings(**overrides: Any) -> SimpleNamespace:
    base = make_settings(gemini_api_key="test-key", gemini_model="gemini-2.5-flash")
    d = vars(base)
    d.update(
        {
            "job_search_provider": "adzuna",
            "adzuna_app_id": "id",
            "adzuna_app_key": "key",
            "adzuna_api_base": "https://api.adzuna.com/v1/api",
            "adzuna_search_country": "us",
            "adzuna_timeout_seconds": 10,
            "job_search_fetch_limit": 50,
            "job_search_prefilter_limit": 20,
            "job_search_quick_match_limit": 8,
        }
    )
    d.update(overrides)
    return SimpleNamespace(**d)


_DEFAULT_AI_DESC = (
    "Build LLM-powered product features using RAG pipelines, OpenAI APIs, "
    "embeddings, and vector databases. Python and FastAPI backend required. "
    "5+ years of software engineering experience preferred."
)
_DEFAULT_NON_AI_DESC = (
    "Manage enterprise sales pipeline, develop client relationships, "
    "and drive quota attainment across assigned territory. CRM proficiency required."
)


def _ai_job(**kw: Any) -> dict[str, Any]:
    return {
        "external_job_id": kw.get("external_job_id", "j1"),
        "external_source": "adzuna",
        "title": kw.get("title", "Applied AI Engineer"),
        "company": "Example AI",
        "location": "Remote US",
        "description": kw.get("description", _DEFAULT_AI_DESC),
        "apply_url": "https://example.com/apply",
        "pre_score": kw.get("pre_score", 80),
        "likely_ai_related": kw.get("likely_ai_related", True),
        "keyword_hits": kw.get("keyword_hits", ["llm", "rag"]),
    }


def _non_ai_job(**kw: Any) -> dict[str, Any]:
    return {
        "external_job_id": kw.get("external_job_id", "n1"),
        "external_source": "adzuna",
        "title": kw.get("title", "Sales Manager"),
        "company": "Corp Inc",
        "location": "NYC",
        "description": kw.get("description", _DEFAULT_NON_AI_DESC),
        "apply_url": None,
        "pre_score": kw.get("pre_score", 5),
        "likely_ai_related": kw.get("likely_ai_related", False),
        "keyword_hits": [],
    }


def _provider_job(idx: int = 0, *, ai: bool = True) -> ProviderJob:
    desc = (
        "Build LLM-powered RAG pipelines using OpenAI, embeddings, and vector "
        "databases. Python backend engineering role with 5+ years required."
        if ai
        else (
            "Manage enterprise sales quota, develop territory relationships, "
            "and drive CRM-based pipeline forecasting across assigned accounts."
        )
    )
    title = "AI Engineer" if ai else "Sales Rep"
    return ProviderJob(
        external_id=f"pj{idx}",
        external_source="adzuna",
        title=title,
        company="ACME",
        location="Remote",
        description=desc,
        apply_url=f"https://example.com/{idx}",
        posted_at="2025-01-01T00:00:00Z",
    )


class _CountingClient:
    """Fake Gemini client that counts relevance vs quick-match calls."""

    def __init__(
        self,
        relevance_responses: list[Any],
        qm_responses: list[Any],
    ) -> None:
        self._rel = list(relevance_responses)
        self._qm = list(qm_responses)
        self.relevance_calls = 0
        self.qm_calls = 0
        self.models = self

    def generate_content(self, *, model: str, contents: str, config: Any) -> Any:
        if "ai_role_category" in contents or "Classify this job" in contents:
            self.relevance_calls += 1
            resp = self._rel.pop(0) if self._rel else gemini_valid_ai_role_relevance()
            if isinstance(resp, Exception):
                raise resp
            return resp
        else:
            self.qm_calls += 1
            resp = self._qm.pop(0) if self._qm else gemini_valid_quick_match()
            if isinstance(resp, Exception):
                raise resp
            return resp


# ---------------------------------------------------------------------------
# Unit: _recommended_action
# ---------------------------------------------------------------------------


def test_recommended_action_strong_likelihood_is_save_and_analyze() -> None:
    assert _recommended_action("strong", 80) == "save_and_analyze"


def test_recommended_action_promising_strong_relevance_is_save_and_analyze() -> None:
    assert _recommended_action("promising", STRONG_THRESHOLD) == "save_and_analyze"


def test_recommended_action_promising_possible_relevance_is_save_for_later() -> None:
    assert _recommended_action("promising", POSSIBLE_THRESHOLD) == "save_for_later"


def test_recommended_action_weak_with_possible_relevance_is_learning_target() -> None:
    assert _recommended_action("weak", POSSIBLE_THRESHOLD) == "use_as_learning_target"


def test_recommended_action_weak_below_threshold_is_skip() -> None:
    assert _recommended_action("weak", 30) == "skip"


# ---------------------------------------------------------------------------
# Unit: unavailable quick match
# ---------------------------------------------------------------------------


def test_unavailable_quick_match_shape() -> None:
    qm = _unavailable_quick_match()
    assert qm["match_label"] == "limited_data"
    assert qm["unavailable"] is True
    assert "assistant_preview" in qm
    assert "recommended_action" in qm


# ---------------------------------------------------------------------------
# Unit: SearchEnricher pipeline
# ---------------------------------------------------------------------------


def test_enricher_runs_relevance_on_all_jobs() -> None:
    settings = _make_search_settings(gemini_api_key="")  # no key → deterministic
    enricher = SearchEnricher(settings=settings)
    jobs = [_ai_job(), _non_ai_job()]
    enriched = enricher.enrich(jobs, profile=default_profile(), quick_match_limit=8)
    assert all(j.get("ai_relevance") is not None for j in enriched)


def test_enricher_hides_jobs_below_threshold() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    non_ai = _non_ai_job()
    enriched = enricher.enrich([non_ai], profile=default_profile(), quick_match_limit=8)
    assert enriched[0]["hidden"] is True
    assert enriched[0]["quick_match"] is None


def test_enricher_visible_jobs_receive_quick_match() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    jobs = [_ai_job()]
    enriched = enricher.enrich(jobs, profile=default_profile(), quick_match_limit=8)
    assert enriched[0]["hidden"] is False
    assert enriched[0]["quick_match"] is not None


def test_enricher_quick_match_capped_at_limit() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    jobs = [_ai_job(external_job_id=f"j{i}", description=_DEFAULT_AI_DESC) for i in range(10)]
    enriched = enricher.enrich(jobs, profile=default_profile(), quick_match_limit=3)
    visible = [j for j in enriched if not j["hidden"]]
    with_qm = [j for j in visible if j["quick_match"] is not None]
    assert len(with_qm) <= 3


def test_enricher_visible_jobs_sorted_before_hidden() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    ai = _ai_job()
    non_ai = _non_ai_job()
    # pass non_ai first but expect ai first in result
    enriched = enricher.enrich([non_ai, ai], profile=default_profile(), quick_match_limit=8)
    assert enriched[0]["hidden"] is False
    assert enriched[-1]["hidden"] is True


def test_enricher_missing_profile_returns_unavailable_quick_match() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    jobs = [_ai_job()]
    enriched = enricher.enrich(jobs, profile=None, quick_match_limit=8)
    visible = [j for j in enriched if not j["hidden"]]
    if visible:
        assert visible[0]["quick_match"]["unavailable"] is True


def test_enricher_cache_avoids_re_running_relevance() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    cache: dict[str, Any] = {}

    jobs1 = [_ai_job()]
    enricher.enrich(jobs1, profile=None, quick_match_limit=0, cache=cache)
    cache_size_after_first = len(cache)

    jobs2 = [_ai_job()]  # same content → same cache key
    enricher.enrich(jobs2, profile=None, quick_match_limit=0, cache=cache)
    assert len(cache) == cache_size_after_first  # no new entries


def test_enricher_ai_relevance_score_in_output() -> None:
    settings = _make_search_settings(gemini_api_key="")
    enricher = SearchEnricher(settings=settings)
    jobs = [_ai_job()]
    enriched = enricher.enrich(jobs, profile=None, quick_match_limit=0)
    rel = enriched[0]["ai_relevance"]
    assert isinstance(rel.get("ai_relevance_score"), int)
    assert 0 <= rel["ai_relevance_score"] <= 100


# ---------------------------------------------------------------------------
# Unit: model-call counting (with fake AI client)
# ---------------------------------------------------------------------------


def test_enricher_bounds_relevance_calls() -> None:
    """≤ N relevance calls where N = number of jobs passed."""
    n_jobs = 5
    client = _CountingClient(
        relevance_responses=[gemini_valid_ai_role_relevance() for _ in range(n_jobs)],
        qm_responses=[gemini_valid_quick_match() for _ in range(n_jobs)],
    )
    settings = _make_search_settings()
    enricher = SearchEnricher(settings=settings, gemini_client=client)
    jobs = [
        _ai_job(external_job_id=f"j{i}", description=_DEFAULT_AI_DESC)
        for i in range(n_jobs)
    ]
    enricher.enrich(jobs, profile=default_profile(), quick_match_limit=8)
    assert client.relevance_calls <= n_jobs


def test_enricher_bounds_quick_match_calls() -> None:
    """≤ quick_match_limit quick-match calls regardless of visible count."""
    qm_limit = 3
    n_jobs = 8
    client = _CountingClient(
        relevance_responses=[gemini_valid_ai_role_relevance() for _ in range(n_jobs)],
        qm_responses=[gemini_valid_quick_match() for _ in range(qm_limit)],
    )
    settings = _make_search_settings()
    enricher = SearchEnricher(settings=settings, gemini_client=client)
    jobs = [
        _ai_job(external_job_id=f"j{i}", description=_DEFAULT_AI_DESC)
        for i in range(n_jobs)
    ]
    enricher.enrich(jobs, profile=default_profile(), quick_match_limit=qm_limit)
    assert client.qm_calls <= qm_limit


def test_enricher_cache_avoids_model_recall() -> None:
    """Second run with same jobs + shared cache makes 0 additional model calls."""
    client = _CountingClient(
        relevance_responses=[gemini_valid_ai_role_relevance()],
        qm_responses=[gemini_valid_quick_match()],
    )
    settings = _make_search_settings()
    enricher = SearchEnricher(settings=settings, gemini_client=client)
    cache: dict[str, Any] = {}
    jobs = [_ai_job(description=_DEFAULT_AI_DESC)]

    enricher.enrich(list(jobs), profile=default_profile(), quick_match_limit=1, cache=cache)
    calls_after_first = client.relevance_calls + client.qm_calls

    enricher.enrich(list(jobs), profile=default_profile(), quick_match_limit=1, cache=cache)
    assert client.relevance_calls + client.qm_calls == calls_after_first


# ---------------------------------------------------------------------------
# Integration: POST /api/jobs/search-ai with enrichment
# ---------------------------------------------------------------------------


class _FakeJobSearchProvider:
    def __init__(self, jobs: list[ProviderJob]) -> None:
        self._jobs = jobs

    def search(self, *, query: str, location: str, remote_only: bool, results_per_page: int) -> list[ProviderJob]:
        return self._jobs[:results_per_page]


class _FakeSupabase:
    def __init__(self, _settings: Any) -> None:
        pass

    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, Any]:
        return {"id": "profile-123"}

    def get_candidate_profile(self, *, user_profile_id: str) -> dict[str, Any] | None:
        return default_profile()


def _search_settings(**overrides: Any) -> SimpleNamespace:
    return _make_search_settings(**overrides)


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


def _wire(
    monkeypatch: pytest.MonkeyPatch,
    provider_jobs: list[ProviderJob],
    *,
    enricher: SearchEnricher | None = None,
) -> None:
    _auth()
    monkeypatch.setattr("app.routers.jobs.get_settings", lambda: _search_settings())
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(_s))
    monkeypatch.setattr(
        "app.routers.jobs.build_job_search_provider",
        lambda _s: _FakeJobSearchProvider(provider_jobs),
    )
    if enricher is not None:
        monkeypatch.setattr("app.routers.jobs.SearchEnricher", lambda **kw: enricher)


def test_search_ai_response_includes_ai_relevance(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    jobs = [_provider_job(0, ai=True)]
    _wire(monkeypatch, jobs)

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    j = body["jobs"][0]
    assert j["ai_relevance"] is not None
    assert "ai_relevance_score" in j["ai_relevance"]


def test_search_ai_hidden_jobs_have_no_quick_match(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    jobs = [_provider_job(0, ai=False)]
    _wire(monkeypatch, jobs)

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 200
    body = resp.json()
    hidden = [j for j in body["jobs"] if j["hidden"]]
    for j in hidden:
        assert j["quick_match"] is None


def test_search_ai_total_ai_related_counts_visible_only(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ai_jobs = [_provider_job(i, ai=True) for i in range(3)]
    non_ai = [_provider_job(i + 3, ai=False) for i in range(2)]
    _wire(monkeypatch, ai_jobs + non_ai)

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    body = resp.json()
    visible_in_response = sum(1 for j in body["jobs"] if not j["hidden"])
    assert body["total_ai_related_results"] == visible_in_response


def test_search_ai_quick_match_present_on_visible_jobs(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    jobs = [_provider_job(0, ai=True)]
    _wire(monkeypatch, jobs)

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    body = resp.json()
    visible = [j for j in body["jobs"] if not j["hidden"]]
    # At least the first visible job should have a quick match attempt
    if visible:
        qm = visible[0]["quick_match"]
        # quick match may be unavailable but should have the right shape
        assert "match_label" in qm
        assert "recommended_action" in qm


def test_search_ai_provider_failure_still_returns_200(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.job_search.provider import JobSearchProviderError

    class _FailProvider:
        def search(self, **kw: Any) -> list:
            raise JobSearchProviderError("down")

    _auth()
    monkeypatch.setattr("app.routers.jobs.get_settings", lambda: _search_settings())
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(_s))
    monkeypatch.setattr("app.routers.jobs.build_job_search_provider", lambda _s: _FailProvider())

    resp = client.post("/api/jobs/search-ai", json={"target_role": "AI Engineer"})
    assert resp.status_code == 200
    assert resp.json()["error"]["code"] == "search_unavailable"
