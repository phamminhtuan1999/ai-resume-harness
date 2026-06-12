"""US-033/US-063 cover letter tests: guards, honesty (claims avoided),
CV-grounded generation, persistence with version linkage."""

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
from app.services.ai.errors import (
    MissingDraftCvError,
    MissingMatchAnalysisError,
    UnauthorizedError,
)

from app.services.ai.cover_letter_workflow import CoverLetterWorkflow

_STRENGTHS = [{"strength": "FastAPI", "resume_evidence": "Built FastAPI services."}]


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> CoverLetterWorkflow:
    return CoverLetterWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


def seed_tailored_cv(data: FakeData, *, bullets: list[str] | None = None) -> dict:
    """US-063: the letter is written from a Tailored CV with renderable content."""
    bullet_rows = [
        {
            "id": f"b{i}",
            "text": text,
            "source_evidence": "ev",
            "truth_guard_status": "safe_to_use",
            "keywords_used": [],
            "user_action": "pending",
        }
        for i, text in enumerate(bullets or ["Built FastAPI services for production."])
    ]
    return data.insert_draft_cv(
        user_profile_id="profile_1",
        match_id="match_1",
        job_id="job_1",
        resume_id="resume_1",
        title="Draft CV — Acme AI Senior AI Engineer",
        status="ready_to_export",
        cv_json={
            "candidate": {"full_name": "Dana Engineer"},
            "professional_summary": "Backend engineer with FastAPI depth.",
            "skills": [{"category": "Backend", "items": ["FastAPI"]}],
            "work_experience": [
                {"company": "Acme", "title": "Engineer", "bullets": bullet_rows}
            ],
            "projects": [],
        },
        cv_strategy_json={},
        quality_notes_json=[],
        confidence_score=0.8,
        provider="deterministic",
        model_name="m",
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


def test_requires_a_tailored_cv() -> None:
    """US-063: no Tailored CV -> guided error, never a raw-resume fallback."""
    data = FakeData(saved_analysis_row=saved_match_row())  # analyzed, but no CV
    with pytest.raises(MissingDraftCvError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_cover_letter is None
    assert data.last_status == "failed"


def test_requires_renderable_cv_content() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    draft = seed_tailored_cv(data)
    # Gate everything out: no summary, the only bullet unsupported.
    draft["cv_json"]["professional_summary"] = ""
    draft["cv_json"]["work_experience"][0]["bullets"][0]["truth_guard_status"] = (
        "do_not_use_yet"
    )
    with pytest.raises(MissingDraftCvError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.saved_cover_letter is None


# --- gemini + persistence -------------------------------------------------------


def test_gemini_path_persists_cover_letter_with_source_linkage() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    draft = seed_tailored_cv(data)
    client = FakeGeminiClient([gemini_valid_cover_letter(confidence_score=0.79)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    saved = data.saved_cover_letter
    assert saved is not None
    assert saved["provider"] == "gemini"
    assert saved["cover_letter"]
    assert saved["tone"] == "professional"
    # US-063 version linkage for the staleness hint.
    assert saved["source_draft_cv_id"] == str(draft["id"])
    assert saved["source_draft_cv_version"] == draft["version"]
    assert data.activities[-1]["activity_type"].startswith("cover_letter.")


def test_prompt_grounds_the_letter_in_the_renderable_cv() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    seed_tailored_cv(data, bullets=["Built FastAPI services.", "Shipped Postgres tooling."])
    wf = _wf(data)
    context = wf.authorize(subject_id="match_1", user_profile_id="profile_1")
    context["user_profile_id"] = "profile_1"
    prompt = wf.build_prompt(wf.load_input(context))
    assert "Tailored CV content" in prompt
    assert "Built FastAPI services." in prompt
    assert "Shipped Postgres tooling." in prompt
    assert "Reference ONLY claims" in prompt


# --- deterministic honesty ------------------------------------------------------


def test_deterministic_references_company_role_and_avoids_true_gaps() -> None:
    data = FakeData(saved_analysis_row=saved_match_row(top_strengths_json=_STRENGTHS))
    seed_tailored_cv(data)
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


def test_deterministic_builder_restricts_claims_to_renderable_bullets() -> None:
    """US-063: with cv_bullets, an analysis strength that did not survive into
    the renderable CV is dropped; when none survive, the bullets themselves
    become the key points."""
    analysis = saved_match_row(
        top_strengths_json=[
            {"strength": "FastAPI", "resume_evidence": "x"},
            {"strength": "Kafka", "resume_evidence": "x"},
        ]
    )
    out = build_cover_letter(
        match_analysis=analysis,
        job_title="Senior AI Engineer",
        company="Acme AI",
        cv_bullets=["Built FastAPI services for production."],
    )
    assert out["key_points_used"] == ["FastAPI"]  # Kafka is not in the CV

    none_survive = build_cover_letter(
        match_analysis=analysis,
        job_title="Senior AI Engineer",
        company="Acme AI",
        cv_bullets=["Shipped Postgres tooling."],
    )
    assert none_survive["key_points_used"] == ["Shipped Postgres tooling."]
