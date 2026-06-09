"""US-034 roadmap tests: 4-week enforcement, gap placement, guards, fallback."""

from __future__ import annotations

import json

import pytest
from ai_fakes import (
    JD_SECRET,
    RESUME_SECRET,
    FakeData,
    FakeGeminiClient,
    gemini_three_week_roadmap,
    gemini_valid_roadmap,
    make_settings,
    saved_match_row,
    saved_missing_skills_row,
    valid_roadmap,
)

from app.schemas.roadmap import RoadmapOutput
from app.services.ai.errors import (
    MissingMatchAnalysisError,
    MissingSkillAnalysisRequiredError,
    UnauthorizedError,
)
from app.services.ai.roadmap_deterministic import build_roadmap
from app.services.ai.roadmap_workflow import RoadmapWorkflow


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _data(**kwargs) -> FakeData:
    kwargs.setdefault("saved_analysis_row", saved_match_row())
    kwargs.setdefault("missing_skills_row", saved_missing_skills_row())
    return FakeData(**kwargs)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> RoadmapWorkflow:
    return RoadmapWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- dependency guards (pre-flight: no run/roadmap/activity rows) -----------------


def test_requires_missing_skill_analysis_and_writes_nothing() -> None:
    data = _data(missing_skills_row=None)
    with pytest.raises(MissingSkillAnalysisRequiredError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []
    assert data.activities == []
    assert data.saved_roadmap is None


def test_requires_match_analysis() -> None:
    data = _data(saved_analysis_row=None)
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []
    assert data.saved_roadmap is None


# --- gemini path -------------------------------------------------------------------


def test_gemini_path_persists_roadmap_run_and_activity() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_valid_roadmap()])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    assert data.last_status == "completed"
    assert result["workflow_run"]["model_provider"] == "gemini"
    weeks = result["result"]["weeks"]
    assert [w["week"] for w in weeks] == [1, 2, 3, 4]
    assert data.saved_roadmap is not None
    assert data.saved_roadmap["title"].startswith("4-week AI Engineer improvement roadmap")
    assert data.saved_roadmap["roadmap_json"]["recommended_project_theme"]
    activity = data.activities[-1]
    assert activity["activity_type"] == "roadmap.completed"
    assert activity["related_match_id"] == "match_1"


def test_three_week_output_retries_then_falls_back() -> None:
    data = _data()
    # Both structured-output attempts return 3 weeks -> schema-invalid -> fallback.
    client = FakeGeminiClient([gemini_three_week_roadmap(), gemini_three_week_roadmap()])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    # two schema-invalid attempts, +1 US-037 activity-description attempt.
    assert client.models.calls == 3
    assert result["workflow_run"]["model_provider"] == "deterministic"
    assert [w["week"] for w in result["result"]["weeks"]] == [1, 2, 3, 4]


def test_critical_gap_outside_weeks_1_2_flags_needs_review() -> None:
    data = _data()
    # Critical gaps are RAG + Embeddings, but weeks 1-2 cover unrelated skills.
    payload = valid_roadmap()
    payload["weeks"][0]["skills_covered"] = ["Kubernetes"]
    payload["weeks"][1]["skills_covered"] = ["Terraform"]
    client = FakeGeminiClient([gemini_valid_roadmap(weeks=payload["weeks"])])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    assert data.last_status == "needs_review"
    assert result["workflow_run"]["confidence_score"] <= 0.5


def test_empty_deliverables_flags_needs_review() -> None:
    data = _data()
    payload = valid_roadmap()
    payload["weeks"][2]["deliverables"] = []
    client = FakeGeminiClient([gemini_valid_roadmap(weeks=payload["weeks"])])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    assert data.last_status == "needs_review"
    assert result["workflow_run"]["status"] == "needs_review"


# --- deterministic fallback ---------------------------------------------------------


def test_deterministic_fallback_without_key() -> None:
    data = _data()
    result = _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "deterministic"
    weeks = result["result"]["weeks"]
    assert [w["week"] for w in weeks] == [1, 2, 3, 4]
    # Critical gaps (RAG, Embeddings) sorted into weeks 1-2.
    assert weeks[0]["skills_covered"] == ["RAG"]
    assert weeks[1]["skills_covered"] == ["Embeddings"]
    # Fallback confidence is 0.5 -> below the 0.7 bar -> needs_review.
    assert result["workflow_run"]["status"] == "needs_review"
    assert data.saved_roadmap is not None


def test_deterministic_builder_pads_with_fallback_skills() -> None:
    out = build_roadmap(missing_skills=[], target_role="AI Engineer", company="Acme")
    RoadmapOutput.model_validate(out)  # schema-valid, exactly 4 weeks
    assert [w["week"] for w in out["weeks"]] == [1, 2, 3, 4]
    assert out["weeks"][0]["skills_covered"] == ["LLM API integration"]
    assert all(w["deliverables"] for w in out["weeks"])
    assert all(w["resume_bullet_after_completion"] for w in out["weeks"])


def test_output_schema_rejects_wrong_week_numbers() -> None:
    payload = valid_roadmap()
    payload["weeks"][3]["week"] = 5
    with pytest.raises(Exception):
        RoadmapOutput.model_validate(payload)


# --- log redaction --------------------------------------------------------------


def test_no_raw_resume_or_jd_in_logs(caplog: pytest.LogCaptureFixture) -> None:
    data = _data()
    with caplog.at_level("INFO"):
        _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")
    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert RESUME_SECRET not in log_text
    assert JD_SECRET not in log_text
    # The canonical run line is present and JSON-parseable.
    run_lines = [
        line for line in log_text.splitlines() if '"event": "ai_workflow_run"' in line
    ]
    assert run_lines
    assert json.loads(run_lines[-1])["workflow_type"] == "roadmap"
