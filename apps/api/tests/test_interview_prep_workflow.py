"""US-035 interview prep tests: guards, mapping, fallback, needs_review, redaction."""

from __future__ import annotations

import pytest
from ai_fakes import (
    JD_SECRET,
    RESUME_SECRET,
    FakeData,
    FakeGeminiClient,
    default_job,
    gemini_invalid,
    gemini_valid_interview_prep,
    make_settings,
    saved_match_row,
    saved_missing_skills_row,
)

from app.schemas.interview_prep import InterviewPrepOutput
from app.services.ai.errors import (
    MissingJobRequirementsError,
    MissingMatchAnalysisError,
    UnauthorizedError,
)
from app.services.ai.interview_prep_deterministic import build_interview_prep
from app.services.ai.interview_prep_workflow import InterviewPrepWorkflow


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _data(**kwargs) -> FakeData:
    kwargs.setdefault("saved_analysis_row", saved_match_row())
    kwargs.setdefault("missing_skills_row", saved_missing_skills_row())
    return FakeData(**kwargs)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> InterviewPrepWorkflow:
    return InterviewPrepWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- guards ----------------------------------------------------------------------


def test_unauthorized_writes_no_rows() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []
    assert data.saved_interview_prep is None


def test_requires_match_analysis() -> None:
    data = _data(saved_analysis_row=None)
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_interview_prep is None
    assert data.last_status == "failed"


def test_requires_job_description() -> None:
    data = _data(job=default_job() | {"raw_description": "  "})
    with pytest.raises(MissingJobRequirementsError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_interview_prep is None


# --- gemini path + column mapping ---------------------------------------------------


def test_gemini_path_persists_mapped_columns_and_activity() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_valid_interview_prep()])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    assert data.last_status == "completed"
    assert result["workflow_run"]["model_provider"] == "gemini"

    prep = data.saved_interview_prep
    assert prep is not None
    assert set(prep["questions_json"]) == {
        "technical_questions",
        "ai_llm_questions",
        "system_design_questions",
        "behavioral_questions",
    }
    assert prep["weak_topics_json"] == ["vector databases", "embeddings evaluation"]
    assert prep["study_plan_json"]["prep_summary"].startswith("Expect deep RAG")
    assert prep["answer_guidance_json"][1]["resume_evidence_to_use"] is None
    assert prep["answer_guidance_json"][1]["warning"]
    activity = data.activities[-1]
    assert activity["activity_type"] == "interview_prep.completed"
    assert activity["related_match_id"] == "match_1"


def test_low_confidence_flags_needs_review() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_valid_interview_prep(confidence_score=0.5)])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )
    assert result["workflow_run"]["status"] == "needs_review"
    assert data.saved_interview_prep is not None  # still persisted


def test_invalid_json_retries_then_falls_back() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_invalid(), gemini_invalid()])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )
    # two invalid-JSON attempts, +1 US-037 activity-description attempt.
    assert client.models.calls == 3
    assert result["workflow_run"]["model_provider"] == "deterministic"


# --- deterministic fallback ---------------------------------------------------------


def test_deterministic_fallback_without_key() -> None:
    data = _data()
    result = _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "deterministic"
    # Fallback confidence 0.5 < 0.6 bar -> needs_review, still persisted.
    assert result["workflow_run"]["status"] == "needs_review"
    out = result["result"]
    assert out["weak_topics_to_study"][:2] == ["RAG", "Embeddings"]
    assert out["technical_questions"]
    assert out["ai_llm_questions"]
    assert out["system_design_questions"]
    assert out["behavioral_questions"]


def test_deterministic_builder_is_schema_valid_and_truthful() -> None:
    out = build_interview_prep(
        match_analysis=saved_match_row(),
        missing_skills=saved_missing_skills_row()["missing_skills_json"],
        job_title="Senior AI Engineer",
        company="Acme AI",
        target_role="AI Engineer",
    )
    validated = InterviewPrepOutput.model_validate(out)
    weak_items = [g for g in validated.answer_guidance if g.resume_evidence_to_use is None]
    assert weak_items, "weak topics must produce null-evidence guidance"
    assert all(item.warning for item in weak_items)


def test_deterministic_builder_handles_empty_inputs() -> None:
    out = build_interview_prep(
        match_analysis={},
        missing_skills=[],
        job_title="",
        company="",
        target_role="AI Engineer",
    )
    InterviewPrepOutput.model_validate(out)
    assert out["weak_topics_to_study"] == ["Interview evidence depth"]


# --- log redaction --------------------------------------------------------------


def test_no_raw_resume_or_jd_in_logs(caplog: pytest.LogCaptureFixture) -> None:
    data = _data()
    with caplog.at_level("INFO"):
        _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")
    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert RESUME_SECRET not in log_text
    assert JD_SECRET not in log_text
