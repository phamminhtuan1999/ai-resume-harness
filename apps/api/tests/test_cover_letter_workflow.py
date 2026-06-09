"""US-033 cover letter tests: guards, honesty (claims avoided), persistence."""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    gemini_valid_cover_letter,
    make_settings,
    saved_match_row,
)

from app.services.ai.cover_letter_deterministic import build_cover_letter
from app.services.ai.errors import MissingMatchAnalysisError, UnauthorizedError

from app.services.ai.cover_letter_workflow import CoverLetterWorkflow

_STRENGTHS = [{"strength": "FastAPI", "resume_evidence": "Built FastAPI services."}]


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> CoverLetterWorkflow:
    return CoverLetterWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


# --- guards ---------------------------------------------------------------------


def test_requires_a_saved_match_analysis() -> None:
    data = FakeData(saved_analysis_row=None)
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_cover_letter is None
    assert data.last_status == "failed"


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []


# --- gemini + persistence -------------------------------------------------------


def test_gemini_path_persists_cover_letter() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    client = FakeGeminiClient([gemini_valid_cover_letter(confidence_score=0.79)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    saved = data.saved_cover_letter
    assert saved is not None
    assert saved["provider"] == "gemini"
    assert saved["cover_letter"]
    assert saved["tone"] == "professional"
    assert data.activities[-1]["activity_type"].startswith("cover_letter.")


# --- deterministic honesty ------------------------------------------------------


def test_deterministic_references_company_role_and_avoids_true_gaps() -> None:
    data = FakeData(saved_analysis_row=saved_match_row(top_strengths_json=_STRENGTHS))
    _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    saved = data.saved_cover_letter
    assert "Acme AI" in saved["cover_letter"]  # company referenced
    assert "Senior AI Engineer" in saved["cover_letter"]  # role referenced
    # True gaps from the analysis are surfaced as claims avoided, never claimed.
    assert saved["claims_avoided_json"] == ["RAG", "Embeddings"]
    assert "FastAPI" in saved["key_points_json"]
    assert saved["provider"] == "deterministic"


def test_deterministic_builder_avoids_only_true_gaps() -> None:
    out = build_cover_letter(
        match_analysis=saved_match_row(top_strengths_json=_STRENGTHS),
        job_title="Senior AI Engineer",
        company="Acme AI",
    )
    # Kafka (wording_gap) and Evaluation (proof_gap) are not "claims avoided".
    assert out["claims_avoided"] == ["RAG", "Embeddings"]
    assert out["tone"] == "professional"
