"""US-054 decision history integration tests.

Covers the read-only history endpoint: ownership denial, empty (never-recomputed)
state, newest-first ordering with transition fields, the 20-entry cap with a
surfaced dropped count, and input-freshness summaries drawn from the snapshot's
inputs_snapshot_json timestamps.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import FakeData, default_job, default_resume, make_settings
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
    monkeypatch.setattr("app.routers.matches.SupabaseDataClient", lambda _s: data)


def _owned_match() -> FakeData:
    return FakeData(match={"id": "match_1"}, resume=default_resume(), job=default_job())


def _snapshot(seq: int, label: str, *, previous_label=None, rules_version="p11.r1", profile_updated="2026-06-10T00:00:00Z") -> dict:
    return {
        "id": f"decision_{seq}",
        "match_id": "match_1",
        "label": label,
        "display_label": label.replace("_", " ").title(),
        "match_score": 63,
        "risk_level": "medium",
        "confidence": 0.8,
        "summary": "snapshot",
        "previous_label": previous_label,
        "rules_version": rules_version,
        "decided_at": f"2026-06-10T00:00:{seq:02d}Z",
        "inputs_snapshot_json": {
            "resume": {"id": "resume_1", "updated_at": "2026-06-08T00:00:00Z"},
            "job": {"id": "job_1", "updated_at": "2026-06-08T00:00:00Z"},
            "profile": {"id": "profile_1", "updated_at": profile_updated},
        },
    }


def test_history_unowned_match_is_404(client, monkeypatch):
    _authenticate()
    _wire(monkeypatch, FakeData(owned=False))
    assert client.get("/api/matches/match_1/analysis-package/history").status_code == 404


def test_history_empty_for_never_recomputed_match(client, monkeypatch):
    _authenticate()
    _wire(monkeypatch, _owned_match())

    body = client.get("/api/matches/match_1/analysis-package/history").json()
    assert body["entries"] == []
    assert body["total"] == 0
    assert body["dropped"] == 0


def test_history_is_newest_first_with_transition_fields(client, monkeypatch):
    _authenticate()
    data = _owned_match()
    # Appended oldest-first; the endpoint returns them newest-first.
    data.decision_snapshots.append(_snapshot(1, "not_recommended"))
    data.decision_snapshots.append(_snapshot(2, "learning_target", previous_label="not_recommended"))
    _wire(monkeypatch, data)

    body = client.get("/api/matches/match_1/analysis-package/history").json()
    assert [e["label"] for e in body["entries"]] == ["learning_target", "not_recommended"]
    newest = body["entries"][0]
    assert newest["previous_label"] == "not_recommended"
    assert newest["rules_version"] == "p11.r1"
    assert newest["decided_at"]
    assert body["total"] == 2
    assert body["dropped"] == 0


def test_history_caps_at_twenty_and_reports_dropped(client, monkeypatch):
    _authenticate()
    data = _owned_match()
    for seq in range(1, 23):  # 22 snapshots
        data.decision_snapshots.append(_snapshot(seq, "apply_with_improvements"))
    _wire(monkeypatch, data)

    body = client.get("/api/matches/match_1/analysis-package/history").json()
    assert body["returned"] == 20
    assert len(body["entries"]) == 20
    assert body["total"] == 22
    assert body["dropped"] == 2  # "2 older runs not shown"


def test_history_summarizes_input_freshness(client, monkeypatch):
    _authenticate()
    data = _owned_match()
    data.decision_snapshots.append(
        _snapshot(1, "strong_apply", profile_updated="2026-06-10T09:30:00Z")
    )
    _wire(monkeypatch, data)

    entry = client.get("/api/matches/match_1/analysis-package/history").json()["entries"][0]
    # Human-readable freshness only — never raw row ids.
    assert entry["inputs"]["profile_updated_at"] == "2026-06-10T09:30:00Z"
    assert "id" not in entry["inputs"]


def test_history_marks_rules_version_change_between_runs(client, monkeypatch):
    _authenticate()
    data = _owned_match()
    data.decision_snapshots.append(_snapshot(1, "apply_with_improvements", rules_version="p11.r1"))
    data.decision_snapshots.append(_snapshot(2, "apply_with_improvements", rules_version="p11.r2"))
    _wire(monkeypatch, data)

    versions = [e["rules_version"] for e in client.get(
        "/api/matches/match_1/analysis-package/history"
    ).json()["entries"]]
    # Adjacent entries carry different rules_versions; the web view renders the
    # "decision rules updated" marker between them.
    assert versions == ["p11.r2", "p11.r1"]
