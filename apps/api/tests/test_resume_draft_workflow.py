"""US-032 tailored resume draft tests: guards, exclusion rules, persistence."""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    gemini_valid_resume_draft,
    make_settings,
    saved_match_row,
)

from app.services.ai.errors import (
    MissingMatchAnalysisError,
    MissingProfileError,
    UnauthorizedError,
)
from app.services.ai.resume_draft_deterministic import build_resume_draft
from app.services.ai.resume_draft_workflow import ResumeDraftWorkflow

_SUGGESTION_ROWS = [
    {"suggested_text": "Emphasize FastAPI production work.", "truth_guard_status": "Safe to use", "user_action": "pending"},
    {"suggested_text": "Maybe surface queue experience.", "truth_guard_status": "Needs confirmation", "user_action": "pending"},
    {"suggested_text": "Claim RAG pipelines.", "truth_guard_status": "Do not use yet", "user_action": "pending"},
    {"suggested_text": "Add Kafka.", "truth_guard_status": "Needs confirmation", "user_action": "rejected"},
]


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> ResumeDraftWorkflow:
    return ResumeDraftWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


def _match(**overrides):
    return {"id": "match_1", "resume_id": "resume_1", "job_id": "job_1", **overrides}


# --- guards ---------------------------------------------------------------------


def test_requires_a_saved_match_analysis() -> None:
    data = FakeData(match=_match(), saved_analysis_row=None)
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_resume_version is None
    assert data.last_status == "failed"


def test_requires_resume_text() -> None:
    data = FakeData(
        match=_match(),
        resume={"id": "resume_1", "title": "R", "raw_text": "", "structured_json": None},
        saved_analysis_row=saved_match_row(),
    )
    with pytest.raises(MissingProfileError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []


# --- gemini + persistence -------------------------------------------------------


def test_gemini_path_persists_resume_version() -> None:
    data = FakeData(match=_match(), saved_analysis_row=saved_match_row())
    client = FakeGeminiClient([gemini_valid_resume_draft(confidence_score=0.8)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    assert data.saved_resume_version is not None
    assert data.saved_resume_version["match_id"] == "match_1"
    assert data.saved_resume_version["resume_id"] == "resume_1"
    assert "# Tailored Resume" in data.saved_resume_version["content_markdown"]
    assert data.activities[-1]["activity_type"].startswith("resume_draft.")


# --- deterministic exclusion rules ----------------------------------------------


def test_deterministic_excludes_do_not_use_and_rejected() -> None:
    data = FakeData(
        match=_match(),
        saved_analysis_row=saved_match_row(),
        resume_suggestions_rows=_SUGGESTION_ROWS,
    )
    _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    md = data.saved_resume_version["content_markdown"]
    assert "Emphasize FastAPI production work." in md  # Safe to use included
    assert "Claim RAG pipelines." not in md  # Do not use yet excluded
    assert "Add Kafka." not in md  # rejected excluded


def test_deterministic_builder_partitions_suggestions() -> None:
    out = build_resume_draft(
        resume_title="Backend Resume",
        resume_text="Python and FastAPI engineer.",
        job_title="AI Engineer",
        company="Acme",
        suggestions=_SUGGESTION_ROWS,
    )
    reasons = {item["reason"] for item in out["excluded_suggestions"]}
    assert "unsupported" in reasons  # Do not use yet
    assert "not_selected" in reasons  # rejected
    assert "Emphasize FastAPI production work." in out["included_suggestions"]
    assert out["resume_markdown"].startswith("# Backend Resume tailored for AI Engineer")
