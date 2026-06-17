"""US-076 — URL + Paste preview endpoints (non-saving relevance preview).

Covers ``POST /api/jobs/extract-from-description`` (paste) and
``POST /api/jobs/preview-url`` (URL): structured extraction + AI relevance
returned as a preview, with nothing persisted. Relevance is monkeypatched so
these tests never call a real provider.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.job import JobExtraction


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


def _extraction(**overrides: object) -> JobExtraction:
    base = dict(
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
        raw_description="We are hiring a Senior Applied AI Engineer to build LLM "
        "products with RAG pipelines and agents on AWS.",
        confidence_score=0.9,
    )
    base.update(overrides)
    return JobExtraction(**base)


def _relevance_snapshot(**overrides: object) -> dict:
    snapshot = {
        "is_ai_related": True,
        "ai_relevance_score": 84,
        "ai_role_category": "applied_ai_engineer",
        "transition_friendliness": "high",
        "research_heavy": False,
        "engineering_focused": True,
        "relevance_reason": "Builds LLM products with RAG.",
        "detected_ai_keywords": ["llm", "rag"],
        "exclude_reason": None,
        "confidence_score": 0.8,
    }
    snapshot.update(overrides)
    return snapshot


class _FakeSupabase:
    """URL preview dedup lookup; never saves (preview is non-persisting)."""

    def __init__(self, _settings: object, existing: dict | None = None) -> None:
        self._existing = existing

    def get_profile_for_clerk_user(self, clerk_user_id: str) -> dict[str, str]:
        return {"id": "profile_123"}

    def find_job_by_normalized_url(
        self, *, user_profile_id: str, normalized_url: str
    ) -> dict | None:
        return self._existing


def _patch_relevance(monkeypatch: pytest.MonkeyPatch, **overrides: object) -> None:
    monkeypatch.setattr(
        "app.routers.jobs.run_relevance_preview",
        lambda job, *, settings: _relevance_snapshot(**overrides),
    )


# --- extract-from-description (Paste JD) -----------------------------------------


def test_extract_requires_authentication(client: TestClient) -> None:
    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "x" * 80},
    )
    assert response.status_code == 401


def test_extract_rejects_too_short_description(client: TestClient) -> None:
    _authenticate()
    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "too short"},
    )
    assert response.status_code == 422
    assert "too short" in response.json()["detail"].lower()


def test_extract_returns_structured_fields_and_relevance(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(),
    )
    _patch_relevance(monkeypatch)

    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "Senior Applied AI Engineer building RAG systems " * 3},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Senior Applied AI Engineer"
    assert body["company"] == "Acme AI"
    assert body["work_type"] == "remote"
    assert body["employment_type"] == "full-time"
    assert body["required_skills"] == ["Python", "FastAPI", "RAG"]
    assert body["needs_confirmation"] is False
    assert body["relevance_available"] is True
    assert body["ai_relevance"]["ai_relevance_score"] == 84
    assert body["ai_relevance"]["is_ai_related"] is True
    # Preview never persists or carries URL provenance.
    assert body["source_url"] is None
    assert body["duplicate"] is False


def test_extract_flags_needs_confirmation_when_company_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(company=None),
    )
    _patch_relevance(monkeypatch)

    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "A role description long enough to pass validation here."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["company"] is None
    assert body["needs_confirmation"] is True


def test_extract_user_title_company_override_model(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(title="Model Title", company=None),
    )
    _patch_relevance(monkeypatch)

    response = client.post(
        "/api/jobs/extract-from-description",
        json={
            "raw_description": "A role description long enough to pass validation here.",
            "title": "My Title",
            "company": "My Company",
        },
    )

    body = response.json()
    assert body["title"] == "My Title"
    assert body["company"] == "My Company"
    assert body["needs_confirmation"] is False


def test_extract_relevance_failure_degrades_to_extraction_only(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(),
    )

    def _boom(job, *, settings):
        raise RuntimeError("relevance exploded")

    monkeypatch.setattr("app.routers.jobs.run_relevance_preview", _boom)

    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "A role description long enough to pass validation here."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["relevance_available"] is False
    assert body["ai_relevance"] is None
    # Extraction still came through.
    assert body["title"] == "Senior Applied AI Engineer"


def test_extract_service_unavailable_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    from app.services.job_extractor import JobExtractionServiceUnavailableError

    def _unavailable(*, markdown, settings):
        raise JobExtractionServiceUnavailableError("Gemini is temporarily unavailable.")

    monkeypatch.setattr("app.routers.jobs.extract_job_from_markdown", _unavailable)

    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "A role description long enough to pass validation here."},
    )
    assert response.status_code == 503


def test_extract_invalid_extraction_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    from app.services.job_extractor import JobExtractionError

    def _bad(*, markdown, settings):
        raise JobExtractionError("invalid json")

    monkeypatch.setattr("app.routers.jobs.extract_job_from_markdown", _bad)

    response = client.post(
        "/api/jobs/extract-from-description",
        json={"raw_description": "A role description long enough to pass validation here."},
    )
    assert response.status_code == 502


# --- preview-url (URL import, non-saving) ----------------------------------------


def test_preview_url_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/jobs/preview-url", json={"source_url": "https://x.co/j"})
    assert response.status_code == 401


def test_preview_url_rejects_invalid_url(client: TestClient) -> None:
    _authenticate()
    response = client.post("/api/jobs/preview-url", json={"source_url": "not a url"})
    assert response.status_code == 422


def test_preview_url_returns_extraction_and_relevance_without_saving(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None)
    )
    monkeypatch.setattr(
        "app.routers.jobs.scrape_job_page",
        lambda *, url, settings: "# Senior Applied AI Engineer\nAcme AI",
    )
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(),
    )
    _patch_relevance(monkeypatch)

    response = client.post(
        "/api/jobs/preview-url",
        json={"source_url": "https://careers.acme.com/jobs/123?utm_source=li"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Senior Applied AI Engineer"
    assert body["company"] == "Acme AI"
    assert body["ai_relevance"]["ai_relevance_score"] == 84
    assert body["relevance_available"] is True
    assert body["duplicate"] is False
    assert body["source_url"] == "https://careers.acme.com/jobs/123?utm_source=li"
    assert body["normalized_url"] == "https://careers.acme.com/jobs/123"
    # No job_id field exists on a preview — nothing was persisted.
    assert "job_id" not in body


def test_preview_url_flags_duplicate(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.SupabaseDataClient",
        lambda _s: _FakeSupabase(None, existing={"id": "job_existing_7"}),
    )
    monkeypatch.setattr(
        "app.routers.jobs.scrape_job_page",
        lambda *, url, settings: "# Role\nAcme",
    )
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(),
    )
    _patch_relevance(monkeypatch)

    response = client.post(
        "/api/jobs/preview-url",
        json={"source_url": "https://careers.acme.com/jobs/123"},
    )

    body = response.json()
    assert body["duplicate"] is True
    assert body["duplicate_job_id"] == "job_existing_7"


def test_preview_url_company_fallback_from_host(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    monkeypatch.setattr(
        "app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None)
    )
    monkeypatch.setattr(
        "app.routers.jobs.scrape_job_page",
        lambda *, url, settings: "# Engineer\n",
    )
    monkeypatch.setattr(
        "app.routers.jobs.extract_job_from_markdown",
        lambda *, markdown, settings: _extraction(company=None),
    )
    _patch_relevance(monkeypatch)

    response = client.post(
        "/api/jobs/preview-url",
        json={"source_url": "https://boards.greenhouse.io/acme/jobs/9"},
    )

    body = response.json()
    # Company falls back to a host-derived name rather than being left blank.
    assert body["company"]
    assert body["needs_confirmation"] is False


def test_preview_url_fetch_not_configured_returns_manual_fallback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    from app.services.firecrawl_client import FirecrawlNotConfiguredError

    monkeypatch.setattr(
        "app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None)
    )

    def _not_configured(*, url, settings):
        raise FirecrawlNotConfiguredError("no key")

    monkeypatch.setattr("app.routers.jobs.scrape_job_page", _not_configured)

    response = client.post(
        "/api/jobs/preview-url",
        json={"source_url": "https://acme.com/jobs/1"},
    )
    assert response.status_code == 503
    assert "paste" in response.json()["detail"].lower()


def test_preview_url_fetch_failure_returns_manual_fallback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    from app.services.firecrawl_client import FirecrawlFetchError

    monkeypatch.setattr(
        "app.routers.jobs.SupabaseDataClient", lambda _s: _FakeSupabase(None)
    )

    def _fetch_error(*, url, settings):
        raise FirecrawlFetchError("boom")

    monkeypatch.setattr("app.routers.jobs.scrape_job_page", _fetch_error)

    response = client.post(
        "/api/jobs/preview-url",
        json={"source_url": "https://acme.com/jobs/1"},
    )
    assert response.status_code == 502
    assert "paste" in response.json()["detail"].lower()
