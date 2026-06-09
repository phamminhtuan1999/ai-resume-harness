"""US-038 panel tests: run-full orchestration, blocking, prepared flip, routes."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import FakeData, make_settings, saved_match_row, saved_missing_skills_row
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.services.ai.errors import AIWorkflowError, UnauthorizedError
from app.services.ai.missing_skills_workflow import MissingSkillsWorkflow
from app.services.ai.run_full_orchestrator import (
    BLOCKED_ERROR_CODE,
    STEP_MANIFEST,
    RunFullOrchestrator,
)


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


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
    monkeypatch.setattr(
        "app.routers.matches.get_settings", lambda: make_settings(gemini_api_key="")
    )
    monkeypatch.setattr("app.routers.matches.SupabaseDataClient", lambda _s: data)


def _data(**kwargs) -> FakeData:
    # Saved analysis + missing-skill rows satisfy every downstream guard, so the
    # whole chain can run deterministically (no key, no live calls).
    kwargs.setdefault("saved_analysis_row", saved_match_row())
    kwargs.setdefault("missing_skills_row", saved_missing_skills_row())
    return FakeData(**kwargs)


class _FailingWorkflow:
    """Stands in for a step whose run always fails with a typed error."""

    def __init__(self, **_kwargs) -> None: ...

    def run(self, **_kwargs):
        raise AIWorkflowError("boom")


def _orchestrator(data: FakeData, **kwargs) -> RunFullOrchestrator:
    return RunFullOrchestrator(
        data_client=data, settings=make_settings(gemini_api_key=""), **kwargs
    )


# --- orchestrator unit tests --------------------------------------------------------


def test_run_full_completes_all_steps_and_flips_prepared() -> None:
    data = _data()
    result = _orchestrator(data).run(match_id="match_1", user_profile_id="profile_1")

    assert result["status"] == "complete"
    assert result["steps_completed"] == len(STEP_MANIFEST)
    assert result["steps_failed"] == 0
    assert result["steps_blocked"] == 0
    assert result["application_status"] == "prepared"
    assert data.prepared_flips == ["match_1"]
    run_types = [run["workflow_type"] for run in data.runs]
    assert run_types == [workflow_type for workflow_type, _cls, _deps in STEP_MANIFEST]


def test_failed_gate_step_blocks_all_dependents() -> None:
    data = _data()
    manifest = tuple(
        (workflow_type, _FailingWorkflow if workflow_type == "match_analysis" else cls, deps)
        for workflow_type, cls, deps in STEP_MANIFEST
    )
    result = _orchestrator(data, manifest=manifest).run(
        match_id="match_1", user_profile_id="profile_1"
    )

    assert result["status"] == "partial"
    assert result["failed_step"] == "match_analysis"
    assert result["steps_failed"] == 1
    assert result["steps_blocked"] == len(STEP_MANIFEST) - 1
    assert result["application_status"] is None
    assert data.prepared_flips == []
    # Blocked rows are failed runs with the dependency error code.
    blocked_updates = [
        fields for _run_id, fields in data.run_updates
        if fields.get("error_code") == BLOCKED_ERROR_CODE
    ]
    assert len(blocked_updates) == len(STEP_MANIFEST) - 1
    assert all(f["status"] == "failed" for f in blocked_updates)


def test_mid_chain_failure_blocks_only_dependents() -> None:
    data = _data()
    manifest = tuple(
        (workflow_type, _FailingWorkflow if workflow_type == "missing_skills" else cls, deps)
        for workflow_type, cls, deps in STEP_MANIFEST
    )
    result = _orchestrator(data, manifest=manifest).run(
        match_id="match_1", user_profile_id="profile_1"
    )

    # resume_suggestions + roadmap depend on missing_skills -> blocked; the
    # rest only depend on match_analysis -> still run.
    assert result["failed_step"] == "missing_skills"
    assert result["steps_blocked"] == 2
    assert result["steps_completed"] == len(STEP_MANIFEST) - 3
    assert data.prepared_flips == []


def test_completed_steps_are_skipped_unless_forced() -> None:
    data = _data(
        latest_runs=[{"workflow_type": "match_analysis", "status": "completed"}]
    )
    result = _orchestrator(data).run(match_id="match_1", user_profile_id="profile_1")

    assert result["status"] == "complete"
    run_types = [run["workflow_type"] for run in data.runs]
    assert "match_analysis" not in run_types  # reused the existing completed run
    assert len(run_types) == len(STEP_MANIFEST) - 1


def test_force_reruns_completed_steps() -> None:
    data = _data(
        latest_runs=[{"workflow_type": "match_analysis", "status": "completed"}]
    )
    _orchestrator(data).run(match_id="match_1", user_profile_id="profile_1", force=True)
    run_types = [run["workflow_type"] for run in data.runs]
    assert "match_analysis" in run_types


def test_no_application_row_means_no_prepared_status() -> None:
    data = _data(has_application=False)
    result = _orchestrator(data).run(match_id="match_1", user_profile_id="profile_1")
    assert result["status"] == "complete"
    assert result["application_status"] is None


def test_unauthorized_runs_nothing() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _orchestrator(data).run(match_id="match_1", user_profile_id="profile_1")
    assert data.runs == []
    assert data.prepared_flips == []


# --- router-level ---------------------------------------------------------------


def test_run_full_endpoint_returns_summary(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = _data()
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/ai-workflow/run-full")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "complete"
    assert body["steps_completed"] == len(STEP_MANIFEST)


def test_run_full_unauthorized_is_403(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(owned=False)
    _wire(monkeypatch, data)

    response = client.post("/api/matches/not_mine/ai-workflow/run-full")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "unauthorized"
    assert data.runs == []


def test_regenerate_unknown_step_is_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = _data()
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/ai-workflow/not_a_step/regenerate")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_step"
    assert data.runs == []


def test_regenerate_known_step_creates_new_run(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = _data()
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/ai-workflow/missing_skills/regenerate")
    assert response.status_code == 200
    assert response.json()["workflow_run"]["workflow_type"] == "missing_skills"
    assert data.runs[-1]["workflow_type"] == "missing_skills"


def test_get_ai_workflow_includes_snapshot_and_error_fields(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = _data(
        latest_runs=[
            {
                "workflow_type": "match_analysis",
                "status": "completed",
                "model_provider": "gemini",
                "model_name": "gemini-2.5-flash",
                "confidence_score": 0.82,
                "completed_at": "2026-06-08T09:01:30Z",
                "output_snapshot_json": {"apply_recommendation": "apply_now"},
                "error_code": None,
                "error_message": None,
            }
        ]
    )
    _wire(monkeypatch, data)

    response = client.get("/api/matches/match_1/ai-workflow")
    assert response.status_code == 200
    run = response.json()["runs"][0]
    assert run["output_snapshot_json"] == {"apply_recommendation": "apply_now"}
    assert run["model_name"] == "gemini-2.5-flash"
    assert run["error_message"] is None


def test_manifest_maps_every_panel_step_to_a_workflow() -> None:
    from app.services.ai.run_full_orchestrator import STEP_WORKFLOWS

    assert set(STEP_WORKFLOWS) == {
        "match_analysis",
        "missing_skills",
        "resume_suggestions",
        "cover_letter",
        "roadmap",
        "interview_prep",
        "assistant_insight",
    }
