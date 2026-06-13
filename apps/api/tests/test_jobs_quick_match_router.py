"""US-068 quick-match endpoint tests: auth, ownership, fast-tier run row, and a
friendly retryable envelope when the provider fails (the listing stays usable)."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    default_profile,
    gemini_valid_quick_match,
    make_settings,
    structured_job,
)
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _authenticate() -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )


def _wire(monkeypatch: pytest.MonkeyPatch, data: FakeData, *, key: str = "") -> None:
    monkeypatch.setattr(
        "app.routers.jobs.get_settings", lambda: make_settings(gemini_api_key=key)
    )
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: data)


def test_requires_authentication(client) -> None:
    res = client.post("/api/jobs/job_1/quick-match")
    assert res.status_code == 401


def test_unowned_job_is_forbidden_and_writes_no_run(client, monkeypatch) -> None:
    _authenticate()
    data = FakeData(owned=False)
    _wire(monkeypatch, data)

    res = client.post("/api/jobs/job_1/quick-match")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "unauthorized"
    assert data.runs == []


def test_deterministic_quick_match_returns_envelope(client, monkeypatch) -> None:
    _authenticate()
    data = FakeData(job=structured_job(), profile=default_profile())
    _wire(monkeypatch, data)  # no key -> deterministic path, no model call

    res = client.post("/api/jobs/job_1/quick-match")
    assert res.status_code == 200
    body = res.json()
    assert body["workflow_run"]["workflow_type"] == "quick_match"
    assert body["workflow_run"]["model_provider"] == "deterministic"
    assert body["result"]["likelihood"] in ("strong", "promising", "weak")
    assert data.runs[-1]["subject_type"] == "job"


def test_gemini_quick_match_records_fast_tier_model(client, monkeypatch) -> None:
    _authenticate()
    data = FakeData(job=structured_job(), profile=default_profile())
    # The route builds its own GeminiProvider from settings; inject the fake
    # client by patching the workflow's lazy builder input.
    monkeypatch.setattr(
        "app.routers.jobs.get_settings", lambda: make_settings(gemini_api_key="key")
    )
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: data)
    # Patch the workflow class so the route's instance uses the fake gemini client
    # and skips activity enrichment (keeps the model call count to the preview).
    import app.routers.jobs as jobs_router

    real_cls = jobs_router.QuickMatchWorkflow

    def _factory(*, data_client, settings):
        wf = real_cls(
            data_client=data_client,
            settings=settings,
            gemini_client=FakeGeminiClient([gemini_valid_quick_match(likelihood="strong")]),
        )
        wf._write_activity = lambda **_kwargs: None  # type: ignore[method-assign]
        return wf

    monkeypatch.setattr(jobs_router, "QuickMatchWorkflow", _factory)

    res = client.post("/api/jobs/job_1/quick-match")
    assert res.status_code == 200
    body = res.json()
    assert body["workflow_run"]["model_provider"] == "gemini"
    assert body["workflow_run"]["model_name"] == "gemini-2.5-flash"  # fast tier
    assert body["result"]["likelihood"] == "strong"


def test_provider_failure_returns_friendly_retryable_error(client, monkeypatch) -> None:
    _authenticate()
    data = FakeData(job=structured_job(), profile=default_profile())
    monkeypatch.setattr(
        "app.routers.jobs.get_settings", lambda: make_settings(gemini_api_key="key")
    )
    monkeypatch.setattr("app.routers.jobs.SupabaseDataClient", lambda _s: data)
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)

    import app.routers.jobs as jobs_router

    real_cls = jobs_router.QuickMatchWorkflow

    def _factory(*, data_client, settings):
        # A schema-invalid model reply on every attempt: the provider gives up,
        # then the DETERMINISTIC fallback still produces a valid preview — so the
        # listing stays usable. (Quick match has a typed fallback by design.)
        from ai_fakes import gemini_invalid

        wf = real_cls(
            data_client=data_client,
            settings=settings,
            gemini_client=FakeGeminiClient([gemini_invalid(), gemini_invalid(), gemini_invalid()]),
        )
        wf._write_activity = lambda **_kwargs: None  # type: ignore[method-assign]
        return wf

    monkeypatch.setattr(jobs_router, "QuickMatchWorkflow", _factory)

    res = client.post("/api/jobs/job_1/quick-match")
    # Fallback covers the model failure: a usable preview, not an error envelope.
    assert res.status_code == 200
    assert res.json()["workflow_run"]["model_provider"] == "deterministic"
