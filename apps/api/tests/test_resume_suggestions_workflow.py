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
    # The proven strength reuses the candidate's own evidence line verbatim.
    safe = next(s for s in out["suggestions"] if s["truth_guard_status"] == "safe_to_use")
    assert safe["suggested_text"] == _STRENGTH["resume_evidence"]


def test_deterministic_suggested_text_is_resume_ready_never_an_instruction() -> None:
    """US-061: suggested_text feeds CV generation as information, so it must be
    resume-ready content. Coaching ("Clarify...", "Review whether...", "Do not
    claim...") belongs in reason only."""
    out = build_resume_suggestions(
        match_analysis=saved_match_row(top_strengths_json=[_STRENGTH]),
        job_title="AI Engineer",
    )
    instruction_openers = (
        "clarify",
        "review whether",
        "do not claim",
        "tighten",
        "consider",
        "make sure",
    )
    assert out["suggestions"]
    for suggestion in out["suggestions"]:
        text = suggestion["suggested_text"].casefold()
        assert not text.startswith(instruction_openers), suggestion["suggested_text"]
        assert "your resume" not in text, suggestion["suggested_text"]


# --- US-061 tier-1 feedback provenance + response-preserving refresh -------------


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_upsert_preserves_responded_rows_and_drops_duplicate_text() -> None:
    """The real refresh semantics (US-061): pending rows are replaced, responded
    rows survive, and an incoming duplicate of a surviving row's text (any
    casing/whitespace) is never re-inserted."""
    from app.services.supabase_data import SupabaseDataClient

    client = SupabaseDataClient.__new__(SupabaseDataClient)
    calls: list[tuple] = []
    existing = [
        {"id": "s1", "suggested_text": "Lead with FastAPI ownership.", "user_action": "accepted"},
        {"id": "s2", "suggested_text": "Old pending idea.", "user_action": "pending"},
        {"id": "s3", "suggested_text": "Rejected claim.", "user_action": "rejected"},
    ]

    def fake_request(method, path, **kwargs):
        calls.append((method, path, kwargs))
        if method == "GET":
            return _Resp(existing)
        if method == "POST":
            return _Resp([{"id": f"new_{i}"} for i in range(len(kwargs.get("json") or []))])
        return _Resp([])

    client._request = fake_request

    incoming = [
        {"suggested_text": "lead with FASTAPI ownership.", "user_action": "pending"},
        {"suggested_text": "Brand new suggestion.", "user_action": "pending"},
        {"suggested_text": "Rejected   claim.", "user_action": "pending"},
    ]
    created = client.upsert_resume_suggestions(match_id="m1", suggestions=incoming)

    delete = next(c for c in calls if c[0] == "DELETE")
    assert delete[2]["params"]["user_action"] == "eq.pending"  # responded rows untouched
    post = next(c for c in calls if c[0] == "POST")
    assert [r["suggested_text"] for r in post[2]["json"]] == ["Brand new suggestion."]
    assert created == [{"id": "new_0"}]


def test_patch_marks_user_edited_only_when_text_changes_hands() -> None:
    """The real PATCH payload (US-061): an edited text flips user_edited; a plain
    accept/reject never does."""
    from app.services.supabase_data import SupabaseDataClient

    client = SupabaseDataClient.__new__(SupabaseDataClient)
    patches: list[dict] = []

    def fake_request(method, path, **kwargs):
        if method == "GET":
            return _Resp([{"id": "s1"}])  # owned
        if method == "PATCH":
            patches.append(kwargs["json"])
            return _Resp([{**kwargs["json"], "id": "s1"}])
        return _Resp([])

    client._request = fake_request

    client.patch_suggestion_user_action(
        suggestion_id="s1", user_profile_id="p1", user_action="accepted",
        suggested_text="My own wording.",
    )
    client.patch_suggestion_user_action(
        suggestion_id="s1", user_profile_id="p1", user_action="rejected",
    )

    assert patches[0]["user_edited"] is True
    assert patches[0]["suggested_text"] == "My own wording."
    assert "user_edited" not in patches[1]
    assert "suggested_text" not in patches[1]


def test_new_suggestion_rows_start_unedited() -> None:
    data = FakeData(saved_analysis_row=saved_match_row())
    client = FakeGeminiClient([gemini_valid_resume_suggestions(confidence_score=0.82)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")
    assert all(row["user_edited"] is False for row in data.upserted_suggestions)
