"""US-050 Refresh Analysis tests.

Covers the orchestrator core-chain step-profile, the conditional-extraction
predicate, and the async refresh endpoint: 202 + one snapshot at the end of the
chain, downstream artifacts never touched, no snapshot on a failed core step,
the server-side 409 guard, and the friendly 422/404 paths.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import (
    FakeData,
    default_job,
    default_profile,
    default_resume,
    make_settings,
    saved_match_row,
    saved_missing_skills_row,
)
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.services.ai.errors import AIWorkflowError
from app.services.ai.run_full_orchestrator import (
    CORE_MANIFEST,
    CORE_STEP_TYPES,
    EXCLUDED_FROM_CORE,
    RunFullOrchestrator,
)
from app.services.refresh_analysis import run_refresh, should_extract_job


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _authenticate() -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )


def _wire(monkeypatch: pytest.MonkeyPatch, data: FakeData) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)
    monkeypatch.setattr(
        "app.routers.matches.get_settings", lambda: make_settings(gemini_api_key="")
    )
    monkeypatch.setattr("app.routers.matches.SupabaseDataClient", lambda _s: data)


def analyzed_match(**overrides) -> dict:
    base = saved_match_row()
    base.update({"resume_id": "resume_1", "job_id": "job_1", "user_id": "profile_1"})
    base.update(overrides)
    return base


def _refresh_data(**overrides) -> FakeData:
    kwargs = dict(
        match=analyzed_match(),
        resume=default_resume(),
        job=default_job(),
        profile=default_profile(),
        saved_analysis_row=saved_match_row(),
        missing_skills_row=saved_missing_skills_row(),
    )
    kwargs.update(overrides)
    return FakeData(**kwargs)


class _FailingWorkflow:
    def __init__(self, **_kwargs) -> None: ...

    def run(self, **_kwargs):
        raise AIWorkflowError("boom")


# --- Orchestrator core-chain step-profile --------------------------------------


def test_core_manifest_is_exactly_the_three_decision_steps():
    types = [workflow_type for workflow_type, _cls, _deps in CORE_MANIFEST]
    assert types == ["match_analysis", "missing_skills", "assistant_insight"]
    assert set(types) == set(CORE_STEP_TYPES)
    assert not (set(types) & set(EXCLUDED_FROM_CORE))


def test_core_chain_run_excludes_downstream_and_does_not_flip_prepared():
    data = _refresh_data()
    orchestrator = RunFullOrchestrator(
        data_client=data,
        settings=make_settings(gemini_api_key=""),
        manifest=CORE_MANIFEST,
        flip_prepared=False,
    )
    result = orchestrator.run(match_id="match_1", user_profile_id="profile_1", force=True)

    assert result["steps_completed"] == 3
    ran = {run["workflow_type"] for run in data.runs}
    assert ran == {"match_analysis", "missing_skills", "assistant_insight"}
    for excluded in EXCLUDED_FROM_CORE:
        assert excluded not in ran
    # No materials generated → never mark the application "prepared".
    assert data.prepared_flips == []
    assert result["application_status"] is None


# --- should_extract_job predicate ----------------------------------------------


def test_should_extract_job_only_when_not_yet_extracted():
    extracted = {
        "raw_description": "Senior AI Engineer ...",
        "extraction_status": "succeeded",
        "extraction_json": {"required_skills": ["RAG"]},
    }
    assert should_extract_job(extracted) is False

    manual = {"raw_description": "Senior AI Engineer ...", "extraction_status": "not_required"}
    assert should_extract_job(manual) is True

    assert should_extract_job({"raw_description": ""}) is False
    assert should_extract_job(None) is False


# --- run_refresh recompute gating ----------------------------------------------


def test_run_refresh_recomputes_once_on_success():
    data = _refresh_data()
    result = run_refresh(
        data, make_settings(gemini_api_key=""), user_profile_id="profile_1", match_id="match_1"
    )
    assert result["decision_recomputed"] is True
    assert len(data.decision_snapshots) == 1


def test_run_refresh_writes_no_snapshot_when_a_core_step_fails(monkeypatch):
    data = _refresh_data()
    monkeypatch.setattr(
        "app.services.refresh_analysis.CORE_MANIFEST",
        (("match_analysis", _FailingWorkflow, ()),),
    )
    result = run_refresh(
        data, make_settings(gemini_api_key=""), user_profile_id="profile_1", match_id="match_1"
    )
    assert result["decision_recomputed"] is False
    assert data.decision_snapshots == []  # prior package stands


# --- Refresh endpoint ----------------------------------------------------------


def test_refresh_returns_202_and_snapshots_once_at_end(client, monkeypatch):
    _authenticate()
    data = _refresh_data()
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analysis-package/refresh")
    assert response.status_code == 202
    assert response.json()["status"] == "refreshing"
    # Starlette runs the background task before returning — assert its effects.
    assert len(data.decision_snapshots) == 1
    assert data.saved_analysis is not None  # match analysis re-ran (analyzed_at stamped)


def test_refresh_never_touches_downstream_artifacts(client, monkeypatch):
    _authenticate()
    data = _refresh_data()
    _wire(monkeypatch, data)

    client.post("/api/matches/match_1/analysis-package/refresh")
    ran = {run["workflow_type"] for run in data.runs}
    assert "resume_suggestions" not in ran
    assert "cover_letter" not in ran
    assert "roadmap" not in ran
    assert "interview_prep" not in ran
    assert data.saved_roadmap is None
    assert data.saved_cover_letter is None
    assert data.upserted_suggestions is None


def test_second_concurrent_refresh_is_409(client, monkeypatch):
    _authenticate()
    data = _refresh_data(latest_runs=[{"workflow_type": "match_analysis", "status": "running"}])
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analysis-package/refresh")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "refresh_in_progress"
    assert data.decision_snapshots == []  # guard fired before any work


def test_refresh_without_job_description_is_422(client, monkeypatch):
    _authenticate()
    data = _refresh_data(job={"id": "job_1", "raw_description": ""})
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analysis-package/refresh")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "job_description_missing"
    assert data.decision_snapshots == []


def test_refresh_unowned_match_is_404(client, monkeypatch):
    _authenticate()
    data = FakeData(owned=False)
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analysis-package/refresh")
    assert response.status_code == 404


def test_refresh_failed_core_step_writes_no_snapshot(client, monkeypatch):
    _authenticate()
    data = _refresh_data()
    _wire(monkeypatch, data)
    monkeypatch.setattr(
        "app.services.refresh_analysis.CORE_MANIFEST",
        (("match_analysis", _FailingWorkflow, ()),),
    )

    response = client.post("/api/matches/match_1/analysis-package/refresh")
    assert response.status_code == 202  # accepted; failure surfaces via run records
    assert data.decision_snapshots == []
