from collections.abc import Iterator
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.job import JobExtraction
from app.services.firecrawl_client import (
    FirecrawlFetchError,
    FirecrawlNotConfiguredError,
    scrape_job_page,
)
from app.services.job_extractor import (
    JobExtractionError,
    JobExtractionServiceUnavailableError,
    _generate_with_retry,
    _is_temporary_provider_error,
)
from app.services.url_normalize import (
    InvalidJobUrlError,
    fallback_company_from_url,
    validate_and_normalize_url,
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


def _job_extraction() -> JobExtraction:
    return JobExtraction(
        title="Senior Applied AI Engineer",
        company="Acme AI",
        location="Remote US",
        work_type="Fully Remote",
        employment_type="Full Time",
        salary_range="$180k-$220k",
        responsibilities=["Ship RAG features"],
        required_skills=["Python", "FastAPI", "RAG"],
        preferred_skills=["LangGraph"],
        required_experience_years="5+",
        ai_related_requirements=["LLM evaluation"],
        cloud_requirements=["AWS"],
        raw_description="We are hiring a Senior Applied AI Engineer...",
        confidence_score=0.9,
    )


class _FakeSupabase:
    def __init__(self, _settings: object) -> None:
        self.inserted: dict | None = None

    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, str]:
        return {"id": "profile_123"}

    def find_job_by_normalized_url(
        self, *, user_profile_id: str, normalized_url: str
    ) -> dict | None:
        return None

    def insert_job(self, *, user_profile_id: str, job: dict) -> dict[str, str]:
        self.inserted = {"user_profile_id": user_profile_id, **job}
        return {"id": "job_new_1"}


# --- Endpoint: auth + validation -------------------------------------------------


def test_import_url_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/jobs/import-url", json={"source_url": "https://x.co/j"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_import_url_rejects_invalid_url(client: TestClient) -> None:
    _authenticate()

    response = client.post("/api/jobs/import-url", json={"source_url": "not a url"})

    assert response.status_code == 422


# --- Endpoint: happy path --------------------------------------------------------


def test_import_url_fetches_extracts_and_saves(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _FakeSupabase(None)

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: fake)
    monkeypatch.setattr(
        "app.routers.jobs.scrape_job_page",
        lambda *, url, settings: "# Senior Applied AI Engineer\nAcme AI",
    )
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _job_extraction(),
    )

    response = client.post(
        "/api/jobs/import-url",
        json={"source_url": "https://careers.acme.com/jobs/123?utm_source=li"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == "job_new_1"
    assert body["duplicate"] is False
    assert body["company"] == "Acme AI"
    assert body["title"] == "Senior Applied AI Engineer"
    # Free-text provider values are normalized to the allowed sets.
    assert body["work_type"] == "remote"
    assert body["employment_type"] == "full-time"
    assert body["required_skills"] == ["Python", "FastAPI", "RAG"]

    # Persisted row carries source provenance + normalized dedupe key.
    assert fake.inserted is not None
    assert fake.inserted["source"] == "manual_url"
    assert fake.inserted["normalized_url"] == "https://careers.acme.com/jobs/123"
    assert fake.inserted["extraction_status"] == "succeeded"
    assert fake.inserted["parse_status"] == "parsed"


def test_import_url_uses_host_fallback_when_company_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    fake = _FakeSupabase(None)
    extraction = _job_extraction()
    extraction.company = None
    extraction.title = None

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: fake)
    monkeypatch.setattr(
        "app.routers.jobs.scrape_job_page", lambda *, url, settings: "content"
    )
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: extraction,
    )

    response = client.post(
        "/api/jobs/import-url", json={"source_url": "https://boards.greenhouse.io/x/9"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["company"] == "Greenhouse"
    assert body["title"] == "Imported role"


# --- Endpoint: duplicate protection ---------------------------------------------


def test_import_url_returns_existing_job_on_duplicate(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()

    class DupSupabase(_FakeSupabase):
        def find_job_by_normalized_url(self, *, user_profile_id: str, normalized_url: str):
            return {
                "id": "job_existing",
                "company": "Acme AI",
                "title": "Senior Applied AI Engineer",
                "source_url": "https://careers.acme.com/jobs/123",
            }

        def insert_job(self, *, user_profile_id: str, job: dict):  # pragma: no cover
            raise AssertionError("must not insert a duplicate")

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: DupSupabase(None))

    response = client.post(
        "/api/jobs/import-url",
        json={"source_url": "https://careers.acme.com/jobs/123?utm_source=x"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["duplicate"] is True
    assert body["job_id"] == "job_existing"


# --- Endpoint: fetch + extraction failure surfaces manual fallback --------------


def test_import_url_fetch_not_configured_returns_manual_fallback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()

    def boom(*, url, settings):
        raise FirecrawlNotConfiguredError("no key")

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None))
    monkeypatch.setattr("app.routers.jobs.scrape_job_page", boom)

    response = client.post(
        "/api/jobs/import-url", json={"source_url": "https://acme.com/jobs/1"}
    )

    assert response.status_code == 503
    assert "manually" in response.json()["detail"]


def test_import_url_fetch_failure_returns_manual_fallback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()

    def boom(*, url, settings):
        raise FirecrawlFetchError("blocked")

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None))
    monkeypatch.setattr("app.routers.jobs.scrape_job_page", boom)

    response = client.post(
        "/api/jobs/import-url", json={"source_url": "https://acme.com/jobs/1"}
    )

    assert response.status_code == 502
    assert "manually" in response.json()["detail"]


def test_import_url_extraction_unavailable_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()

    def boom(*, markdown, settings):
        raise JobExtractionServiceUnavailableError("busy")

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None))
    monkeypatch.setattr("app.routers.jobs.scrape_job_page", lambda *, url, settings: "x")
    monkeypatch.setattr("app.routers.jobs.extract_job_from_markdown", boom)

    response = client.post(
        "/api/jobs/import-url", json={"source_url": "https://acme.com/jobs/1"}
    )

    assert response.status_code == 503


def test_import_url_invalid_extraction_returns_manual_fallback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()

    def boom(*, markdown, settings):
        raise JobExtractionError("bad json")

    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None))
    monkeypatch.setattr("app.routers.jobs.scrape_job_page", lambda *, url, settings: "x")
    monkeypatch.setattr("app.routers.jobs.extract_job_from_markdown", boom)

    response = client.post(
        "/api/jobs/import-url", json={"source_url": "https://acme.com/jobs/1"}
    )

    assert response.status_code == 502
    assert "manually" in response.json()["detail"]


# --- Unit: URL normalization -----------------------------------------------------


def test_normalize_strips_tracking_and_folds_scheme() -> None:
    source, normalized = validate_and_normalize_url(
        "HTTP://Careers.Acme.com/Jobs/123/?utm_source=li&gclid=9&team=ai"
    )
    assert normalized == "https://careers.acme.com/Jobs/123?team=ai"
    assert source.endswith("team=ai")


def test_normalize_dedupes_tracking_variants() -> None:
    _, a = validate_and_normalize_url("https://acme.com/jobs/1?utm_campaign=x")
    _, b = validate_and_normalize_url("https://acme.com/jobs/1/")
    assert a == b


def test_normalize_adds_scheme_when_missing() -> None:
    source, normalized = validate_and_normalize_url("acme.com/jobs/1")
    assert normalized == "https://acme.com/jobs/1"


@pytest.mark.parametrize("bad", ["", "   ", "ftp://acme.com/x", "not-a-host"])
def test_normalize_rejects_invalid(bad: str) -> None:
    with pytest.raises(InvalidJobUrlError):
        validate_and_normalize_url(bad)


def test_fallback_company_from_url() -> None:
    assert fallback_company_from_url("https://careers.acme.com/jobs/1") == "Acme"
    assert fallback_company_from_url("https://boards.greenhouse.io/x") == "Greenhouse"


# --- Unit: Firecrawl client ------------------------------------------------------


def _settings(**overrides) -> SimpleNamespace:
    base = {
        "firecrawl_api_key": "fc-test",
        "firecrawl_api_base": "https://api.firecrawl.dev",
        "firecrawl_timeout_seconds": 10,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_scrape_requires_api_key() -> None:
    with pytest.raises(FirecrawlNotConfiguredError):
        scrape_job_page(url="https://x.co/j", settings=_settings(firecrawl_api_key=""))


def test_scrape_returns_markdown() -> None:
    def fake_post(endpoint, *, headers, json, timeout):
        return httpx.Response(200, json={"data": {"markdown": "# Role\nbody"}})

    result = scrape_job_page(url="https://x.co/j", settings=_settings(), post=fake_post)
    assert result == "# Role\nbody"


def test_scrape_raises_fetch_error_on_provider_status() -> None:
    def fake_post(endpoint, *, headers, json, timeout):
        return httpx.Response(403, json={"error": "blocked"})

    with pytest.raises(FirecrawlFetchError):
        scrape_job_page(url="https://x.co/j", settings=_settings(), post=fake_post)


def test_scrape_raises_fetch_error_on_empty_content() -> None:
    def fake_post(endpoint, *, headers, json, timeout):
        return httpx.Response(200, json={"data": {"markdown": "   "}})

    with pytest.raises(FirecrawlFetchError):
        scrape_job_page(url="https://x.co/j", settings=_settings(), post=fake_post)


# --- Unit: extractor retry (mirrors candidate-profile retry tests) --------------


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
    return RuntimeError("503 UNAVAILABLE high demand")


def test_job_retry_recovers_after_transient_503(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr("app.services.job_extractor.time.sleep", sleeps.append)
    client = _FakeClient([_sdk_503(), "RESPONSE"])

    result = _generate_with_retry(
        client=client,
        model="gemini-2.5-flash",
        contents="prompt",
        config=None,
        max_attempts=3,
        base_delay_seconds=0.5,
    )

    assert result == "RESPONSE"
    assert client.models.calls == 2
    assert sleeps == [0.5]


def test_job_retry_raises_service_unavailable_when_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.job_extractor.time.sleep", lambda _s: None)
    client = _FakeClient([_sdk_503(), _sdk_503(), _sdk_503()])

    with pytest.raises(JobExtractionServiceUnavailableError):
        _generate_with_retry(
            client=client,
            model="gemini-2.5-flash",
            contents="prompt",
            config=None,
            max_attempts=3,
            base_delay_seconds=0.5,
        )


def test_job_retry_does_not_retry_non_transient(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.job_extractor.time.sleep", lambda _s: None)
    client = _FakeClient([RuntimeError("400 INVALID_ARGUMENT")])

    with pytest.raises(JobExtractionError):
        _generate_with_retry(
            client=client,
            model="gemini-2.5-flash",
            contents="prompt",
            config=None,
            max_attempts=3,
            base_delay_seconds=0.5,
        )

    assert client.models.calls == 1


def test_job_temporary_provider_error_detects_sdk_503_text() -> None:
    assert _is_temporary_provider_error(RuntimeError("503 UNAVAILABLE high demand"))
