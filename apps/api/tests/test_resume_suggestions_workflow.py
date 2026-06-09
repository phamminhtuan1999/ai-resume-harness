"""US-031 resume suggestions tests: dependency guard, Truth Guard mapping,
the 0.6 needs-review threshold override, and deterministic fallback fidelity."""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    gemini_valid_resume_suggestions,
    make_settings,
    saved_match_row,
)

from app.schemas.resume_suggestions import TRUTH_GUARD_DISPLAY
from app.services.ai.errors import MatchAnalysisRequiredError, UnauthorizedError
from app.services.ai.resume_suggestions_deterministic import build_resume_suggestions
from app.services.ai.resume_suggestions_workflow import ResumeSuggestionsWorkflow

_STRENGTH = {
    "strength": "FastAPI",
    "resume_evidence": "Built FastAPI services for 3 years.",
    "job_requirement": "Python/FastAPI services.",
}


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> ResumeSuggestionsWorkflow:
    return ResumeSuggestionsWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- dependency + ownership guards ----------------------------------------------


def test_requires_a_saved_match_analysis() -> None:
    data = FakeData(saved_analysis_row=None)  # match exists but not analyzed
    with pytest.raises(MatchAnalysisRequiredError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.upserted_suggestions is None
    assert data.last_status == "failed"


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []


# --- Truth Guard mapping --------------------------------------------------------


def test_truth_guard_display_mapping_is_title_case() -> None:
    assert TRUTH_GUARD_DISPLAY == {
        "safe_to_use": "Safe to use",
        "needs_confirmation": "Needs confirmation",
        "do_not_use_yet": "Do not use yet",
    }


def test_gemini_path_persists_title_case_truth_guard() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    client = FakeGeminiClient([gemini_valid_resume_suggestions(confidence_score=0.82)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    assert data.upsert_calls == 1
    assert data.upserted_suggestions  # rows were written
    # Persisted rows always carry the stored title-case value, never the AI enum.
    stored = {row["truth_guard_status"] for row in data.upserted_suggestions}
    assert stored
    assert stored <= set(TRUTH_GUARD_DISPLAY.values())
    assert all(row["user_action"] == "pending" for row in data.upserted_suggestions)
    assert data.activities[-1]["activity_type"].startswith("resume_suggestions.")


# --- the US-031 0.6 needs-review threshold override -----------------------------


def test_confidence_between_05_and_06_flags_needs_review() -> None:
    # 0.55 would be "completed" under the foundation default (0.5); US-031 overrides
    # the threshold to 0.6, so this must flag needs_review. Guards the base-workflow
    # `self.low_confidence_threshold` wiring.
    data = FakeData(saved_analysis_row=saved_match_row())
    client = FakeGeminiClient([gemini_valid_resume_suggestions(confidence_score=0.55)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.last_status == "needs_review"
    assert data.upserted_suggestions is not None  # still persisted


# --- deterministic fallback -----------------------------------------------------


def test_deterministic_fallback_persists_and_keeps_snapshot() -> None:
    data = FakeData(saved_analysis_row=saved_match_row(top_strengths_json=[_STRENGTH]))
    result = _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    # Persisted rows are title-case; the snapshot keeps the snake_case schema.
    assert all(r["truth_guard_status"] in TRUTH_GUARD_DISPLAY.values() for r in data.upserted_suggestions)
    res = result["result"]
    assert res["resume_strategy"]
    assert all(s["truth_guard_status"] in TRUTH_GUARD_DISPLAY for s in res["suggestions"])


def test_deterministic_builder_maps_strengths_and_gaps() -> None:
    out = build_resume_suggestions(
        match_analysis=saved_match_row(top_strengths_json=[_STRENGTH]),
        job_title="AI Engineer",
    )
    statuses = {s["truth_guard_status"] for s in out["suggestions"]}
    assert "safe_to_use" in statuses  # from the proven strength
    assert "do_not_use_yet" in statuses  # from true gaps (RAG, Embeddings)
    assert out["do_not_claim"]  # true gaps are listed as claims to avoid
