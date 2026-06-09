"""US-036 dashboard summary tests: data gate, fallback rules, caching, redaction."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    dashboard_input_payload,
    gemini_valid_dashboard_summary,
    make_settings,
)
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.dashboard import NOT_ENOUGH_DATA_MESSAGE, DashboardSummaryOutput
from app.services.ai.dashboard_summary_deterministic import (
    build_dashboard_summary,
    repeated_gaps,
)
from app.services.ai.dashboard_summary_workflow import DashboardSummaryWorkflow
from app.services.ai.errors import MissingProfileError

PROFILE_SECRET = "SECRET_PROFILE_zzz"


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
    monkeypatch.setattr(
        "app.routers.dashboard.get_settings", lambda: make_settings(gemini_api_key="")
    )
    monkeypatch.setattr("app.routers.matches.SupabaseDataClient", lambda _s: data)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> DashboardSummaryWorkflow:
    return DashboardSummaryWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- workflow-level ---------------------------------------------------------------


def test_missing_profile_writes_no_run() -> None:
    data = FakeData(profile={"id": "profile_1"})  # row exists but empty fields
    with pytest.raises(MissingProfileError):
        _wf(data).run(subject_id=None, user_profile_id="profile_1")
    assert data.runs == []
    assert data.saved_dashboard_summary is None


def test_gemini_path_persists_summary_run_and_activity() -> None:
    data = FakeData()
    client = FakeGeminiClient([gemini_valid_dashboard_summary()])
    result = _wf(data, key="key", client=client).run(
        subject_id=None, user_profile_id="profile_1"
    )

    assert data.last_status == "completed"
    assert result["workflow_run"]["model_provider"] == "gemini"
    saved = data.saved_dashboard_summary
    assert saved is not None
    assert saved["job_search_health"] == "moderate"
    assert saved["repeated_skill_gaps_json"] == ["RAG"]
    activity = data.activities[-1]
    assert activity["activity_type"] == "dashboard_summary.completed"


def test_low_confidence_flags_needs_review() -> None:
    data = FakeData()
    client = FakeGeminiClient([gemini_valid_dashboard_summary(confidence_score=0.4)])
    result = _wf(data, key="key", client=client).run(
        subject_id=None, user_profile_id="profile_1"
    )
    assert result["workflow_run"]["status"] == "needs_review"


def test_schema_rejects_bad_health_value() -> None:
    with pytest.raises(Exception):
        DashboardSummaryOutput.model_validate(
            {"dashboard_summary": "x", "job_search_health": "amazing"}
        )


# --- deterministic fallback rules ---------------------------------------------------


def test_deterministic_fallback_rules() -> None:
    data = FakeData()
    result = _wf(data, key="").run(subject_id=None, user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "deterministic"
    out = result["result"]
    # RAG appears in 2 jobs' analyses; Embeddings/Kubernetes only once.
    assert out["repeated_skill_gaps"] == ["RAG"]
    # Jobs scoring >= 65 qualify as best fit.
    assert out["best_fit_roles"] == ["Senior AI Engineer", "ML Platform Engineer"]
    # avg(72, 68, 41) = 60.3 -> moderate.
    assert out["job_search_health"] == "moderate"
    assert out["recommended_next_actions"] == ["Build a portfolio project demonstrating RAG."]
    # Fallback confidence 0.4 < 0.5 bar -> needs_review.
    assert result["workflow_run"]["status"] == "needs_review"


def test_repeated_gaps_sorted_by_frequency() -> None:
    entries = [
        {"missing_skills": [{"skill": "RAG"}, {"skill": "Evaluation"}]},
        {"missing_skills": [{"skill": "Evaluation"}]},
        {"missing_skills": [{"skill": "Evaluation"}, {"skill": "RAG"}]},
        {"missing_skills": [{"skill": "Solo"}]},
    ]
    assert repeated_gaps(entries) == ["Evaluation", "RAG"]


def test_deterministic_builder_handles_empty_payload() -> None:
    out = build_dashboard_summary(
        {"jobs": [], "match_scores": [], "missing_skills_across_jobs": []}
    )
    DashboardSummaryOutput.model_validate(out)
    assert out["job_search_health"] == "weak"
    assert out["recommended_next_actions"] == [
        "Analyze more saved jobs so patterns can emerge."
    ]


# --- router-level: data gate, caching, 204 ------------------------------------------


def test_data_gate_returns_not_enough_data_without_run(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(analyzed_jobs_count=2)
    _wire(monkeypatch, data)

    for call in (
        lambda: client.post("/api/dashboard/ai-summary"),
        lambda: client.get("/api/dashboard/ai-summary"),
    ):
        response = call()
        assert response.status_code == 200
        body = response.json()
        assert body["workflow_run"] is None
        assert body["result"]["job_search_health"] == "not_enough_data"
    assert data.runs == []
    assert data.saved_dashboard_summary is None
    # The §9.6 message constant stays verbatim for the UI.
    assert NOT_ENOUGH_DATA_MESSAGE.startswith("ApplyWise needs more analyzed jobs")


def test_get_returns_204_when_no_summary_yet(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(analyzed_jobs_count=5)
    _wire(monkeypatch, data)

    response = client.get("/api/dashboard/ai-summary")
    assert response.status_code == 204


def test_post_returns_cached_summary_without_rerun(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(analyzed_jobs_count=5)
    _wire(monkeypatch, data)
    data.saved_dashboard_summary = {
        "dashboard_summary": "Cached narrative.",
        "best_fit_roles_json": ["AI Engineer"],
        "repeated_skill_gaps_json": ["RAG"],
        "job_search_health": "moderate",
        "recommended_next_actions_json": ["Build a RAG project."],
        "confidence_score": 0.7,
        "provider": "gemini",
        "updated_at": "2026-06-08T10:00:00Z",
    }

    response = client.post("/api/dashboard/ai-summary")
    assert response.status_code == 200
    assert response.json()["result"]["dashboard_summary"] == "Cached narrative."
    assert data.runs == []  # no new run row


def test_regenerate_overwrites_and_creates_new_run(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(analyzed_jobs_count=5)
    _wire(monkeypatch, data)
    data.saved_dashboard_summary = {"dashboard_summary": "Old.", "job_search_health": "weak"}

    response = client.post("/api/dashboard/ai-summary/regenerate")
    assert response.status_code == 200
    assert len(data.runs) == 1
    assert data.dashboard_upserts == 1
    assert data.saved_dashboard_summary["dashboard_summary"] != "Old."


# --- log redaction --------------------------------------------------------------


def test_no_profile_text_in_logs(caplog: pytest.LogCaptureFixture) -> None:
    data = FakeData(
        profile={
            "id": "profile_1",
            "current_role": "Senior Engineer",
            "target_role": "AI Engineer",
            "technical_background": PROFILE_SECRET,
            "candidate_profile_json": {"secret": PROFILE_SECRET},
        },
        dashboard_input=dashboard_input_payload(),
    )
    with caplog.at_level("INFO"):
        _wf(data, key="").run(subject_id=None, user_profile_id="profile_1")
    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert PROFILE_SECRET not in log_text
