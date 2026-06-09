"""US-030 assistant insight tests: derivation, routing, dependency guard."""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    gemini_valid_insight,
    make_settings,
    saved_match_row,
)

from app.schemas.assistant_insight import (
    NEXT_ACTION_BY_RECOMMENDATION,
    match_to_insight_recommendation,
    score_to_risk_level,
)
from app.services.ai.assistant_insight_workflow import AssistantInsightWorkflow
from app.services.ai.errors import MissingMatchAnalysisError, UnauthorizedError


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> AssistantInsightWorkflow:
    return AssistantInsightWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- pure derivation helpers ----------------------------------------------------


@pytest.mark.parametrize(
    "apply_rec,expected",
    [
        ("apply_now", "apply_now"),
        ("apply_with_improvements", "tailor_resume_first"),
        ("improve_first", "build_project_first"),
        ("not_recommended", "low_priority"),
    ],
)
def test_recommendation_mapping(apply_rec: str, expected: str) -> None:
    assert match_to_insight_recommendation(apply_rec, 50) == expected


@pytest.mark.parametrize("score,risk", [(80, "low"), (75, "low"), (74, "medium"), (40, "medium"), (39, "high")])
def test_risk_level_bands(score: int, risk: str) -> None:
    assert score_to_risk_level(score) == risk


# --- dependency + ownership guards ---------------------------------------------


def test_requires_a_saved_match_analysis() -> None:
    data = FakeData(saved_analysis_row=None)
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_insight is None
    assert data.last_status == "failed"


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []


# --- recommendation/risk/next-action are derived, not trusted from the model ----


def test_postprocess_overrides_model_with_derived_decision() -> None:
    # Saved analysis says apply_with_improvements @ 63; the model optimistically
    # returns apply_now/low risk. Postprocess must override all three fields.
    data = FakeData(
        saved_analysis_row=saved_match_row(apply_recommendation="apply_with_improvements", overall_score=63)
    )
    client = FakeGeminiClient(
        [gemini_valid_insight(recommendation="apply_now", risk_level="low", next_best_action="Apply right away.")]
    )
    result = _wf(data, key="key", client=client).run(
        subject_id="match_1", user_profile_id="profile_1"
    )

    assert result["result"]["recommendation"] == "tailor_resume_first"
    assert result["result"]["risk_level"] == "medium"
    assert result["result"]["next_best_action"] == NEXT_ACTION_BY_RECOMMENDATION["tailor_resume_first"]
    assert data.saved_insight["recommendation"] == "tailor_resume_first"


@pytest.mark.parametrize(
    "apply_rec,overall,expected",
    [
        ("apply_now", 80, "apply_now"),
        ("apply_with_improvements", 63, "tailor_resume_first"),
        ("improve_first", 50, "build_project_first"),
        ("not_recommended", 30, "low_priority"),
    ],
)
def test_routing_for_each_recommendation(apply_rec: str, overall: int, expected: str) -> None:
    data = FakeData(saved_analysis_row=saved_match_row(apply_recommendation=apply_rec, overall_score=overall))
    result = _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")
    assert result["result"]["recommendation"] == expected
    assert result["result"]["next_best_action"] == NEXT_ACTION_BY_RECOMMENDATION[expected]


def test_deterministic_fallback_persists_and_records_activity() -> None:
    data = FakeData(saved_analysis_row=saved_match_row(overall_score=30, apply_recommendation="not_recommended"))
    result = _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    assert result["result"]["recommendation"] == "low_priority"
    assert result["result"]["risk_level"] == "high"
    assert data.saved_insight["provider"] == "deterministic"
    activity = data.activities[-1]
    assert activity["activity_type"].startswith("assistant_insight.")
    assert activity["related_match_id"] == "match_1"
