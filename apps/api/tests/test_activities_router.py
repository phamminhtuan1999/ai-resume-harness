"""US-037 activities router tests: feed listing, pagination, regenerate, ownership."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import FakeData, activity_row, make_settings
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


def _wire(monkeypatch: pytest.MonkeyPatch, data: FakeData) -> None:
    monkeypatch.setattr(
        "app.routers.matches.get_settings", lambda: make_settings(gemini_api_key="")
    )
    monkeypatch.setattr(
        "app.routers.activities.get_settings", lambda: make_settings(gemini_api_key="")
    )
    monkeypatch.setattr("app.routers.matches.SupabaseDataClient", lambda _s: data)


def test_list_returns_activities_newest_first_with_related_job(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    rows = [
        activity_row(id="act_1"),
        activity_row(id="act_2", related_job_id=None, related_job=None),
    ]
    data = FakeData(activity_rows=rows)
    _wire(monkeypatch, data)

    response = client.get("/api/activities")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [a["id"] for a in body["activities"]] == ["act_1", "act_2"]
    assert body["activities"][0]["related_job"]["company"] == "Acme AI"
    assert body["activities"][1]["related_job"] is None


def test_list_respects_limit_and_offset(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    rows = [activity_row(id=f"act_{i}") for i in range(5)]
    data = FakeData(activity_rows=rows)
    _wire(monkeypatch, data)

    response = client.get("/api/activities?limit=2&offset=2")
    body = response.json()
    assert [a["id"] for a in body["activities"]] == ["act_2", "act_3"]
    assert body["total"] == 5
    assert body["limit"] == 2
    assert body["offset"] == 2


def test_list_empty_is_not_an_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(activity_rows=[])
    _wire(monkeypatch, data)

    response = client.get("/api/activities")
    assert response.status_code == 200
    assert response.json() == {"activities": [], "total": 0, "limit": 20, "offset": 0}


def test_regenerate_updates_row_and_records_run(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(
        activity_rows=[activity_row()],
        run_snapshot={"output_snapshot_json": {"overall_score": 78, "confidence_score": 0.8}},
    )
    _wire(monkeypatch, data)

    response = client.post("/api/activities/act_1/generate-description")
    assert response.status_code == 200
    activity = response.json()["activity"]
    # No Gemini key in tests -> the deterministic fallback keeps existing text.
    assert activity["title"] == "Match Analysis — Senior AI Engineer"
    assert data.activity_updates == 1
    # An observability run row is written for the standalone path.
    assert data.runs[-1]["workflow_type"] == "activity_description"
    assert data.last_status == "completed"


def test_regenerate_other_users_activity_is_403(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(activity_rows=[activity_row(user_id="someone_else")])
    _wire(monkeypatch, data)

    response = client.post("/api/activities/act_1/generate-description")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "unauthorized"
    assert data.activity_updates == 0
    assert data.runs == []


def test_regenerate_missing_activity_is_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(activity_rows=[])
    _wire(monkeypatch, data)

    response = client.post("/api/activities/missing/generate-description")
    assert response.status_code == 404


def test_insert_activity_prunes_events_past_retention() -> None:
    from types import SimpleNamespace

    from app.services.supabase_data import SupabaseDataClient

    data_client = SupabaseDataClient.__new__(SupabaseDataClient)
    calls: list[tuple[str, str, dict]] = []

    def record(method, path, **kwargs):
        calls.append((method, path, kwargs))
        return SimpleNamespace(json=lambda: [], headers={})

    data_client._request = record  # type: ignore[method-assign]
    data_client.insert_activity(
        user_profile_id="profile_1",
        workflow_run_id=None,
        activity_type="match_analysis.completed",
        title="t",
    )

    assert [(method, path) for method, path, _kw in calls] == [
        ("POST", "/activity_feed"),
        ("DELETE", "/activity_feed"),
    ]
    delete_params = calls[1][2]["params"]
    assert delete_params["user_id"] == "eq.profile_1"
    assert delete_params["created_at"].startswith("lt.")


def test_unauthenticated_is_401(client: TestClient) -> None:
    app.dependency_overrides.clear()
    response = client.get("/api/activities")
    assert response.status_code in (401, 403)
