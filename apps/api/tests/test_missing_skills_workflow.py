"""US-029 missing skill analysis tests: dependency guard, gap typing, fallback."""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    gemini_valid_missing_skills,
    make_settings,
    saved_match_row,
)

from app.services.ai.errors import MissingMatchAnalysisError, UnauthorizedError
from app.services.ai.missing_skills_deterministic import build_missing_skill_analysis
from app.services.ai.missing_skills_workflow import MissingSkillsWorkflow


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> MissingSkillsWorkflow:
    return MissingSkillsWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- dependency guard -----------------------------------------------------------


def test_requires_a_saved_match_analysis() -> None:
    data = FakeData(saved_analysis_row=None)  # match exists but not analyzed yet
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_missing_skills is None
    assert data.last_status == "failed"  # run row recorded the failure


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []  # ownership checked before any run row


# --- gemini path ----------------------------------------------------------------


def test_gemini_path_persists_and_records_activity() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    client = FakeGeminiClient([gemini_valid_missing_skills(confidence_score=0.81)])
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    assert data.last_status == "completed"
    assert data.saved_missing_skills is not None
    assert data.saved_missing_skills["provider"] == "gemini"
    assert result["result"]["top_3_priority_gaps"] == ["RAG", "Embeddings"]
    activity = data.activities[-1]
    assert activity["activity_type"].startswith("missing_skills.")
    assert activity["related_match_id"] == "match_1"


# --- deterministic fallback maps the saved gaps --------------------------------


def test_deterministic_fallback_maps_saved_gaps() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    result = _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    skills = result["result"]["missing_skills"]
    # The four saved gaps map across, preserving gap_type.
    assert [s["skill"] for s in skills] == ["RAG", "Embeddings", "Kafka", "Evaluation"]
    assert [s["gap_type"] for s in skills] == [
        "true_gap",
        "true_gap",
        "wording_gap",
        "proof_gap",
    ]
    # First three are critical; evidence status follows gap type.
    assert [s["importance"] for s in skills] == ["critical", "critical", "critical", "medium"]
    assert skills[0]["evidence_status"] == "no_evidence"
    assert skills[2]["evidence_status"] == "weak_evidence"
    assert result["result"]["top_3_priority_gaps"] == ["RAG", "Embeddings", "Kafka"]
    assert data.saved_missing_skills["provider"] == "deterministic"


def test_deterministic_builder_handles_empty_gaps() -> None:
    out = build_missing_skill_analysis(match_analysis={"top_gaps_json": []}, job_title="AI Engineer")
    assert out["missing_skills"] == []
    assert out["top_3_priority_gaps"] == []
    assert "AI Engineer" in out["summary"]


def test_activity_marks_high_importance_when_critical_present() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")
    assert data.activities[-1]["importance"] == "high"
