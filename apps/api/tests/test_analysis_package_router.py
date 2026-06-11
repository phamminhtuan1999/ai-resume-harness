"""US-047 analysis package integration tests.

Covers the composed GET (pure read), staleness, the empty/partial states,
ownership, the recompute writer (snapshot persistence, inputs_hash dedupe,
previous_label, activity on label change), the exactly-one-recompute wiring, and
a bounded query-count guard against N+1 over the module tables.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace

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
from app.services.analysis_package import get_analysis_package, recompute_decision


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


def analyzed_match(**overrides) -> dict:
    base = saved_match_row()
    base.update(
        {
            "resume_id": "resume_1",
            "job_id": "job_1",
            "analyzed_at": "2026-06-09T10:00:00Z",
            "updated_at": "2026-06-09T10:00:00Z",
            "top_strengths_json": [{"strength": "FastAPI", "why_it_matters": "Core to the stack."}],
            "risks_json": ["May be screened out for missing RAG."],
        }
    )
    base.update(overrides)
    return base


def insight_row(**overrides) -> dict:
    base = {
        "id": "ai_1",
        "match_id": "match_1",
        "recommendation": "tailor_resume_first",
        "risk_level": "medium",
        "application_strategy": "Lead with backend, add an AI project if real.",
        "confidence_score": 0.78,
        "updated_at": "2026-06-09T09:00:00Z",
    }
    base.update(overrides)
    return base


def snapshot_row(**overrides) -> dict:
    base = {
        "id": "decision_1",
        "label": "apply_with_improvements",
        "display_label": "Apply With Improvements",
        "match_score": 63,
        "scores_json": {
            "overall": 63,
            "skill": 70,
            "experience": 60,
            "ai_readiness": 55,
            "ats_keywords": 65,
            "seniority": 60,
        },
        "risk_level": "medium",
        "confidence": 0.8,
        "confidence_reasons_json": [],
        "summary": "A good match with a few gaps to address.",
        "evidence_json": {
            "matched": [{"label": "FastAPI", "detail": "Core to the stack."}],
            "missing": ["RAG", "Embeddings"],
            "risks": ["May be screened out for missing RAG."],
        },
        "inputs_hash": "hash-abc",
        "rules_version": "p11.r1",
        "previous_label": None,
        "decided_at": "2026-06-09T11:00:00Z",
    }
    base.update(overrides)
    return base


def _full_data(**overrides) -> FakeData:
    kwargs = dict(
        match=analyzed_match(),
        resume={**default_resume(), "updated_at": "2026-06-09T08:00:00Z"},
        job={**default_job(), "updated_at": "2026-06-09T08:00:00Z"},
        profile={**default_profile(), "updated_at": "2026-06-09T08:00:00Z"},
        missing_skills_row=saved_missing_skills_row(),
        assistant_insight_row=insight_row(),
        resume_suggestions_rows=[{"id": "sug_1", "truth_guard_status": "Safe to use", "updated_at": "x"}],
        application=None,
        latest_runs=[
            {"workflow_type": "match_analysis", "status": "completed", "model_provider": "gemini",
             "model_name": "gemini-2.5-flash", "completed_at": "2026-06-09T10:00:00Z"},
        ],
        latest_snapshot=snapshot_row(),
    )
    kwargs.update(overrides)
    return FakeData(**kwargs)


# --- GET composition ------------------------------------------------------------


def test_get_returns_composed_package_from_snapshot(client, monkeypatch):
    _authenticate()
    data = _full_data(application={"status": "applied", "applied_date": "2026-06-08"})
    _wire(monkeypatch, data)

    response = client.get("/api/matches/match_1/analysis-package")
    assert response.status_code == 200
    body = response.json()

    assert body["rules_version"] == "p11.r1"
    assert body["decision"]["label"] == "apply_with_improvements"
    assert body["decision"]["confidence"]["qualitative"]  # qualitative present
    assert body["scores"]["overall"] == 63
    assert body["scores"]["ai_readiness"] == 55
    assert body["resume"]["id"] == "resume_1"
    assert body["application"]["status"] == "applied"
    assert body["evidence"]["matched"][0]["label"] == "FastAPI"
    assert body["skill_gaps"]  # full gap detail from the missing-skills row
    assert body["next_actions"]
    assert body["material_readiness"]["draft_cv"] in {
        "recommended", "allowed_with_warning", "not_recommended"
    }
    assert body["analysis_details"]["steps"]


def test_get_is_pure_read_creates_no_snapshot(client, monkeypatch):
    _authenticate()
    data = _full_data()
    _wire(monkeypatch, data)

    for _ in range(3):
        assert client.get("/api/matches/match_1/analysis-package").status_code == 200
    assert data.decision_snapshots == []  # no write on any read


def test_get_previous_decision_renders_delta(client, monkeypatch):
    _authenticate()
    data = _full_data(latest_snapshot=snapshot_row(previous_label="not_recommended"))
    _wire(monkeypatch, data)

    body = client.get("/api/matches/match_1/analysis-package").json()
    assert body["decision"]["previous"]["label"] == "not_recommended"


def test_get_etag_supports_conditional_304(client, monkeypatch):
    _authenticate()
    data = _full_data()
    _wire(monkeypatch, data)

    first = client.get("/api/matches/match_1/analysis-package")
    etag = first.headers.get("etag")
    assert etag == "hash-abc"

    second = client.get(
        "/api/matches/match_1/analysis-package", headers={"If-None-Match": etag}
    )
    assert second.status_code == 304


def test_get_partial_when_a_core_module_is_absent(client, monkeypatch):
    _authenticate()
    data = _full_data(assistant_insight_row=None, latest_snapshot=None)
    _wire(monkeypatch, data)

    body = client.get("/api/matches/match_1/analysis-package").json()
    assert body["analysis_state"] == "partial"
    assert body["decision"] is not None  # transient verdict still served


def test_get_stale_when_profile_edited_after_decision(client, monkeypatch):
    _authenticate()
    # Profile edited after the snapshot's decided_at (2026-06-09T11:00:00Z).
    data = _full_data(profile={**default_profile(), "updated_at": "2026-06-10T12:00:00Z"})
    _wire(monkeypatch, data)

    body = client.get("/api/matches/match_1/analysis-package").json()
    assert body["stale"] is True
    assert body["analysis_state"] == "stale"


def test_get_not_analyzed_returns_null_decision(client, monkeypatch):
    _authenticate()
    data = FakeData(match={"id": "match_1"}, resume=default_resume(), job=default_job())
    _wire(monkeypatch, data)

    response = client.get("/api/matches/match_1/analysis-package")
    assert response.status_code == 200
    body = response.json()
    assert body["analysis_state"] == "not_analyzed"
    assert body["decision"] is None


def test_get_unowned_match_is_404(client, monkeypatch):
    _authenticate()
    data = FakeData(owned=False)
    _wire(monkeypatch, data)

    assert client.get("/api/matches/match_1/analysis-package").status_code == 404


def test_get_unauthenticated_is_401(client):
    app.dependency_overrides.clear()
    assert client.get("/api/matches/match_1/analysis-package").status_code in (401, 403)


# --- recompute_decision (the only snapshot writer) ------------------------------


def test_recompute_persists_snapshot_with_identity_fields():
    data = _full_data(latest_snapshot=None)
    inserted = recompute_decision(data, user_profile_id="profile_1", match_id="match_1")

    assert inserted is not None
    assert len(data.decision_snapshots) == 1
    snap = data.decision_snapshots[0]
    assert snap["inputs_hash"]
    assert snap["rules_version"] == "p11.r1"
    assert snap["scores_json"]["overall"] == 63
    assert snap["previous_label"] is None


def test_recompute_dedupes_identical_inputs():
    data = _full_data(latest_snapshot=None)
    recompute_decision(data, user_profile_id="profile_1", match_id="match_1")
    recompute_decision(data, user_profile_id="profile_1", match_id="match_1")
    assert len(data.decision_snapshots) == 1  # same inputs_hash → no second row


def test_recompute_records_previous_and_activity_on_label_change():
    data = _full_data(latest_snapshot=None)
    recompute_decision(data, user_profile_id="profile_1", match_id="match_1")
    first_label = data.decision_snapshots[0]["label"]

    # A real input mutation: score collapses and the row's updated_at advances.
    data._match["overall_score"] = 20
    data._match["updated_at"] = "2026-06-11T09:00:00Z"
    recompute_decision(data, user_profile_id="profile_1", match_id="match_1")

    assert len(data.decision_snapshots) == 2
    second = data.decision_snapshots[1]
    assert second["label"] == "not_recommended"
    assert second["previous_label"] == first_label
    changed = [a for a in data.activities if a["activity_type"] == "analysis_decision.changed"]
    assert len(changed) == 1


def test_recompute_no_activity_when_label_unchanged():
    data = _full_data(latest_snapshot=None)
    recompute_decision(data, user_profile_id="profile_1", match_id="match_1")
    # Inputs change (updated_at advances → new hash) but the verdict is the same.
    data._match["updated_at"] = "2026-06-11T09:00:00Z"
    recompute_decision(data, user_profile_id="profile_1", match_id="match_1")

    assert len(data.decision_snapshots) == 2
    changed = [a for a in data.activities if a["activity_type"] == "analysis_decision.changed"]
    assert changed == []


def test_recompute_noop_when_not_analyzed():
    data = FakeData(match={"id": "match_1"}, resume=default_resume(), job=default_job())
    assert recompute_decision(data, user_profile_id="profile_1", match_id="match_1") is None
    assert data.decision_snapshots == []


# --- exactly-one-recompute wiring -----------------------------------------------


def test_analyze_regenerate_triggers_single_recompute(client, monkeypatch):
    _authenticate()
    data = _full_data(latest_snapshot=None)
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analyze/regenerate")
    assert response.status_code == 200
    assert len(data.decision_snapshots) == 1


def test_run_full_snapshots_once(client, monkeypatch):
    _authenticate()
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)
    data = _full_data(latest_snapshot=None)
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/ai-workflow/run-full")
    assert response.status_code == 200
    assert len(data.decision_snapshots) == 1


# --- bounded query count (guard against N+1 over module tables) -----------------


def test_get_analysis_package_is_bounded_query_count():
    from app.services.supabase_data import SupabaseDataClient

    client_obj = SupabaseDataClient.__new__(SupabaseDataClient)
    calls: list[str] = []

    responses = {
        "/matches": [
            {**analyzed_match(), "id": "match_1", "resume_id": "resume_1", "job_id": "job_1"}
        ],
        "/resumes": [{**default_resume(), "updated_at": "2026-06-09T08:00:00Z"}],
        "/jobs": [{**default_job(), "updated_at": "2026-06-09T08:00:00Z"}],
        "/missing_skill_analyses": [saved_missing_skills_row()],
        "/assistant_insights": [insight_row()],
        "/resume_suggestions": [{"id": "sug_1", "truth_guard_status": "Safe to use", "updated_at": "x"}],
        "/user_profiles": [{**default_profile(), "updated_at": "2026-06-09T08:00:00Z"}],
        "/applications": [{"status": "applied", "applied_date": "2026-06-08"}],
        "/ai_workflow_runs": [
            {"workflow_type": "match_analysis", "status": "completed", "model_provider": "gemini"}
        ],
        "/analysis_decisions": [snapshot_row()],
    }

    def fake_request(method, path, **kwargs):
        calls.append(path)
        payload = next((v for key, v in responses.items() if path.startswith(key)), [])
        return SimpleNamespace(json=lambda: payload, headers={})

    client_obj._request = fake_request  # type: ignore[method-assign]

    package, etag = get_analysis_package(
        client_obj, user_profile_id="profile_1", match_id="match_1"
    )
    assert package.decision is not None
    assert etag == "hash-abc"
    assert len(calls) <= 10, f"too many round trips: {calls}"
