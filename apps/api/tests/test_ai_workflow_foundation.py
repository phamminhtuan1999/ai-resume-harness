"""US-027 AI workflow foundation tests.

Unit tests exercise the standard flow through a minimal stub workflow plus the
provider/error/logging primitives. Integration tests drive the real match
endpoints with a fake data client (no live model calls).
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    JD_SECRET,
    RESUME_SECRET,
    gemini_503,
    gemini_invalid,
    gemini_valid,
    make_settings,
)
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.ai_workflow import AIOutputBase
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.errors import (
    ERROR_CLASSES,
    AIWorkflowError,
    SchemaValidationFailureError,
    UnauthorizedError,
)
from app.services.ai.logging import WorkflowLogger, redact
from app.services.ai.providers import ProviderUnavailableError


# --- a minimal workflow to test the foundation in isolation ---------------------


class _StubOutput(AIOutputBase):
    value: str = "ok"


class _StubWorkflow(BaseAIWorkflow):
    workflow_type = "match_analysis"
    subject_type = "match"

    def __init__(self, *, fallback=None, fallback_error=None, authorized=True, **kwargs):
        super().__init__(**kwargs)
        self._fallback = fallback if fallback is not None else {"value": "fb", "confidence_score": 0.6}
        self._fallback_error = fallback_error
        self._authorized = authorized
        self.persisted: dict | None = None

    @property
    def output_model(self):
        return _StubOutput

    def authorize(self, *, subject_id, user_profile_id):
        if not self._authorized:
            raise UnauthorizedError("nope")
        return {"subject_id": subject_id}

    def load_input(self, context):
        return {"context": context}

    def build_prompt(self, data):
        return "PROMPT BODY"

    def deterministic_fallback(self, data):
        if self._fallback_error is not None:
            raise self._fallback_error
        return self._fallback

    def persist(self, *, user_profile_id, subject_id, output, provider_name, status, context, data):
        self.persisted = {"provider": provider_name, "status": status, "output": output}

    def build_activity(self, *, status, output, context):
        return ActivitySpec(activity_type=f"match_analysis.{status}", title="stub")


def _stub(settings, *, data=None, gemini_client=None, **kwargs) -> _StubWorkflow:
    return _StubWorkflow(
        data_client=data or FakeData(),
        settings=settings,
        gemini_client=gemini_client,
        **kwargs,
    )


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


# --- provider selection / retry / fallback --------------------------------------


def test_gemini_used_when_key_present() -> None:
    data = FakeData()
    wf = _stub(
        make_settings(gemini_api_key="key"),
        data=data,
        gemini_client=FakeGeminiClient([gemini_valid(confidence_score=0.9)]),
    )
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "gemini"
    assert result["workflow_run"]["status"] == "completed"
    assert wf.persisted["provider"] == "gemini"


def test_fallback_used_when_key_absent() -> None:
    wf = _stub(make_settings(gemini_api_key=""))
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "deterministic"
    assert result["workflow_run"]["status"] == "completed"


def test_retry_once_on_invalid_json_then_success() -> None:
    client = FakeGeminiClient([gemini_invalid(), gemini_valid(confidence_score=0.8)])
    wf = _stub(make_settings(gemini_api_key="key"), gemini_client=client)
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    # one invalid + one valid retry, plus the US-037 activity-description
    # attempt (exhausts the fake behaviors and falls back to the spec text).
    assert client.models.calls == 3
    assert result["workflow_run"]["model_provider"] == "gemini"
    assert result["workflow_run"]["status"] == "completed"


def test_terminal_provider_error_falls_back_to_deterministic() -> None:
    # 503 on every attempt exhausts the transient retry, then the deterministic
    # fallback produces schema-valid output.
    client = FakeGeminiClient([gemini_503(), gemini_503(), gemini_503()])
    wf = _stub(make_settings(gemini_api_key="key"), gemini_client=client)
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "deterministic"
    assert result["workflow_run"]["status"] == "completed"


def test_invalid_json_twice_then_falls_back_to_deterministic() -> None:
    client = FakeGeminiClient([gemini_invalid(), gemini_invalid()])
    wf = _stub(make_settings(gemini_api_key="key"), gemini_client=client)
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    # invalid, retry-once invalid, then fallback; +1 US-037 description attempt.
    assert client.models.calls == 3
    assert result["workflow_run"]["model_provider"] == "deterministic"


# --- validation / confidence ----------------------------------------------------


def test_schema_validation_failure_raises_typed_error() -> None:
    data = FakeData()
    wf = _stub(
        make_settings(gemini_api_key=""),
        data=data,
        fallback={"value": "x", "confidence_score": 5.0},  # out of [0,1] range
    )
    with pytest.raises(SchemaValidationFailureError) as exc:
        wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert exc.value.code == "schema_validation_failure"
    assert data.last_status == "failed"
    assert wf.persisted is None  # no domain write on failure


def test_low_confidence_sets_needs_review_but_persists() -> None:
    data = FakeData()
    wf = _stub(
        make_settings(gemini_api_key=""),
        data=data,
        fallback={"value": "x", "confidence_score": 0.3},
    )
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["status"] == "needs_review"
    assert wf.persisted is not None  # result still saved


# --- run + activity persistence -------------------------------------------------


def test_successful_run_records_lifecycle_and_activity() -> None:
    data = FakeData()
    wf = _stub(make_settings(gemini_api_key=""), data=data)
    wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert len(data.runs) == 1
    statuses = [f.get("status") for _id, f in data.run_updates]
    assert statuses[0] == "running"
    assert data.last_status == "completed"
    assert data.final_update["latency_ms"] >= 0
    assert len(data.activities) == 1
    assert data.activities[0]["activity_type"] == "match_analysis.completed"


def test_failed_run_writes_run_and_activity_no_persist() -> None:
    data = FakeData()
    wf = _stub(
        make_settings(gemini_api_key="key"),
        data=data,
        gemini_client=FakeGeminiClient([gemini_503(), gemini_503(), gemini_503()]),
        fallback_error=ProviderUnavailableError("outage"),
    )
    with pytest.raises(AIWorkflowError) as exc:
        wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert exc.value.retryable is True
    assert data.last_status == "failed"
    assert data.activities[-1]["activity_type"] == "match_analysis.failed"
    assert wf.persisted is None


def test_unauthorized_writes_no_run() -> None:
    data = FakeData()
    wf = _stub(make_settings(gemini_api_key=""), data=data, authorized=False)
    with pytest.raises(UnauthorizedError):
        wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert data.runs == []
    assert data.activities == []


# --- error taxonomy -------------------------------------------------------------


def test_error_taxonomy_maps_codes_http_and_retryable() -> None:
    seen = set()
    for cls in ERROR_CLASSES:
        err = cls("msg")
        env = err.to_envelope()["error"]
        assert env["code"] == cls.code
        assert env["message"] == "msg"
        assert env["retryable"] == cls.retryable
        assert 400 <= cls.http_status < 600
        seen.add(cls.code)

    # Codes the public contract promises are all represented.
    assert {
        "unauthorized",
        "missing_profile",
        "missing_job_requirements",
        "invalid_json",
        "schema_validation_failure",
        "model_timeout",
        "provider_rate_limit",
        "network_failure",
    } <= seen


# --- log redaction --------------------------------------------------------------


def test_redact_strips_sensitive_keys_recursively() -> None:
    payload = {
        "raw_text": "secret resume",
        "ok": "keep",
        "nested": {"raw_description": "secret jd", "fine": "keep"},
        "list": [{"prompt": "leak"}, {"safe": "keep"}],
    }
    cleaned = redact(payload)
    flat = str(cleaned)
    assert "secret resume" not in flat
    assert "secret jd" not in flat
    assert "leak" not in flat
    assert cleaned["ok"] == "keep"
    assert cleaned["nested"]["fine"] == "keep"


def test_emit_run_line_contains_only_safe_fields() -> None:
    line = WorkflowLogger().emit_run(
        request_id="req-1",
        user_id="profile_1",
        workflow_type="match_analysis",
        subject_type="match",
        status="completed",
        model_provider="deterministic",
        latency_ms=12,
    )
    assert "profile_1" in line
    assert "match_analysis" in line
    assert "PROMPT" not in line


# --- integration: the real match endpoints --------------------------------------


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


def _wire(monkeypatch: pytest.MonkeyPatch, data: FakeData) -> None:
    # Force the deterministic path (no key) so no live model call is made, and
    # inject the fake data client into the router.
    monkeypatch.setattr("app.routers.matches.get_settings", lambda: make_settings(gemini_api_key=""))
    monkeypatch.setattr("app.routers.matches.SupabaseDataClient", lambda _s: data)


def test_analyze_happy_path_writes_result_run_and_activity(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analyze")

    assert response.status_code == 200
    body = response.json()
    assert body["workflow_run"]["workflow_type"] == "match_analysis"
    assert body["workflow_run"]["model_provider"] == "deterministic"
    assert body["workflow_run"]["status"] in {"completed", "needs_review"}
    assert data.saved_analysis is not None
    assert data.saved_analysis["analyzer_provider"] == "deterministic"
    assert data.last_status in {"completed", "needs_review"}
    assert len(data.activities) == 1


def test_analyze_unauthorized_writes_no_run(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(owned=False)
    _wire(monkeypatch, data)

    response = client.post("/api/matches/not_mine/analyze")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "unauthorized"
    assert response.json()["error"]["retryable"] is False
    assert data.runs == []
    assert data.saved_analysis is None


def test_analyze_missing_job_requirements_returns_friendly_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    job = {"id": "job_1", "title": "Role", "company": "Acme", "raw_description": "  ", "parse_status": "not_parsed"}
    data = FakeData(job=job)
    _wire(monkeypatch, data)

    response = client.post("/api/matches/match_1/analyze")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "missing_job_requirements"
    assert data.last_status == "failed"
    assert data.saved_analysis is None


def test_analyze_provider_outage_fails_with_retryable_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _wire(monkeypatch, data)
    # Simulate the deterministic generator itself being unable to produce output.
    monkeypatch.setattr(
        "app.services.ai.match_analysis_workflow.analyze_resume_job_fit",
        lambda **_kw: (_ for _ in ()).throw(ProviderUnavailableError("outage")),
    )

    response = client.post("/api/matches/match_1/analyze")

    assert response.status_code == 503
    assert response.json()["error"]["retryable"] is True
    assert data.last_status == "failed"
    assert data.saved_analysis is None  # no partial domain write


def test_no_resume_or_jd_text_in_logs(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _authenticate()
    data = FakeData()
    _wire(monkeypatch, data)

    with caplog.at_level("INFO"):
        client.post("/api/matches/match_1/analyze")

    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert RESUME_SECRET not in log_text
    assert JD_SECRET not in log_text


def test_ai_workflow_endpoint_returns_latest_runs(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(
        latest_runs=[
            {
                "workflow_type": "match_analysis",
                "status": "completed",
                "model_provider": "gemini",
                "confidence_score": 0.82,
                "completed_at": "2026-06-08T10:00:00Z",
            }
        ]
    )
    _wire(monkeypatch, data)

    response = client.get("/api/matches/match_1/ai-workflow")

    assert response.status_code == 200
    body = response.json()
    assert body["match_id"] == "match_1"
    assert body["runs"][0]["workflow_type"] == "match_analysis"
    assert body["runs"][0]["status"] == "completed"


def test_get_match_analysis_404_when_not_analyzed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(saved_analysis_row={"id": "match_1", "apply_recommendation": None})
    _wire(monkeypatch, data)

    response = client.get("/api/matches/match_1/match-analysis")
    assert response.status_code == 404
