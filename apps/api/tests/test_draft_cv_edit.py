"""US-060 tier-2 polish-and-confirm tests.

Pure logic (stage/confirm state machine, deterministic verify floors,
preservation merge/resolve) plus the wired endpoints through the TestClient
with the in-memory FakeData. No live model calls — the Gemini path uses the
fake client; an empty key exercises the deterministic fallback.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from ai_fakes import FakeData, FakeGeminiClient, gemini_response, make_settings
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.draft_cv import DraftCvOutput
from app.services.ai.bullet_edit import polish_and_verify
from app.services.ai.draft_cv_logic import (
    assign_bullet_ids,
    confirm_bullet_edit,
    find_cv_json_bullet,
    stage_bullet_edit,
)
from app.services.ai.draft_cv_preservation import (
    merge_finalized_bullets,
    resolve_preservation_conflict,
)


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


_CORPUS = "built fastapi services on aws. improved latency by 30%. postgres."


def _pass_result(**overrides) -> dict:
    base = {
        "polished_text": "Polished wording.",
        "truth_guard_status": "needs_confirmation",
        "evidence_question": "What proves it?",
        "provider": "deterministic",
    }
    base.update(overrides)
    return base


def _cv_with_bullet(text: str = "Original text.", bullet_id: str = "b1") -> dict:
    return {
        "work_experience": [
            {
                "company": "Acme",
                "title": "Engineer",
                "bullets": [
                    {
                        "id": bullet_id,
                        "text": text,
                        "source_evidence": "ev",
                        "truth_guard_status": "safe_to_use",
                        "keywords_used": [],
                        "user_action": "pending",
                    }
                ],
            }
        ],
        "projects": [],
    }


# --- deterministic verify floors --------------------------------------------------


def test_deterministic_fallback_skips_polish_and_is_conservative() -> None:
    result = polish_and_verify(
        user_text="Built FastAPI services on AWS.",
        cv_json={},
        corpus=_CORPUS,
        settings=make_settings(gemini_api_key=""),
    )
    assert result["polished_text"] == "Built FastAPI services on AWS."  # no polish
    assert result["truth_guard_status"] == "needs_confirmation"  # never safe by default
    assert result["evidence_question"]
    assert result["provider"] == "deterministic"


def test_deterministic_fallback_flags_invented_metric() -> None:
    result = polish_and_verify(
        user_text="Cut costs by 90%.",
        cv_json={},
        corpus=_CORPUS,
        settings=make_settings(gemini_api_key=""),
    )
    assert result["truth_guard_status"] == "do_not_use_yet"
    assert "90%" in result["evidence_question"]


def test_gemini_polish_keeps_information_parity_floors() -> None:
    # Model invents a number in the polish -> the user's wording wins; model
    # calls an invented-metric edit safe -> the metrics floor outranks it.
    client = FakeGeminiClient(
        [
            gemini_response(
                text=json.dumps(
                    {
                        "polished_text": "Slashed costs 75% via FastAPI.",
                        "truth_guard_status": "safe_to_use",
                        "evidence_question": None,
                    }
                )
            )
        ]
    )
    result = polish_and_verify(
        user_text="Cut costs by 90%.",
        cv_json={},
        corpus=_CORPUS,
        settings=make_settings(gemini_api_key="key"),
        gemini_client=client,
    )
    assert result["polished_text"] == "Cut costs by 90%."  # 75% was invented
    assert result["truth_guard_status"] == "do_not_use_yet"  # 90% not in corpus
    assert result["evidence_question"]


def test_gemini_polish_happy_path_can_be_safe() -> None:
    client = FakeGeminiClient(
        [
            gemini_response(
                text=json.dumps(
                    {
                        "polished_text": "Engineered FastAPI services on AWS, cutting latency 30%.",
                        "truth_guard_status": "safe_to_use",
                        "evidence_question": None,
                    }
                )
            )
        ]
    )
    result = polish_and_verify(
        user_text="I built the FastAPI services on AWS and cut latency 30%.",
        cv_json=_cv_with_bullet(),
        corpus=_CORPUS,
        settings=make_settings(gemini_api_key="key"),
        gemini_client=client,
    )
    assert result["provider"] == "gemini"
    assert result["truth_guard_status"] == "safe_to_use"
    assert result["evidence_question"] is None
    assert result["polished_text"].startswith("Engineered")


# --- stage / confirm state machine ------------------------------------------------


def test_stage_then_confirm_polished_applies_server_stored_result() -> None:
    cv = _cv_with_bullet()
    assert stage_bullet_edit(cv, "b1", "My edit.", _pass_result())
    bullet = find_cv_json_bullet(cv, "b1")
    assert bullet["pending_edit"]["user_text"] == "My edit."
    assert bullet["text"] == "Original text."  # nothing user-visible changed yet

    confirmed = confirm_bullet_edit(cv, "b1", "polished", now_iso="2026-06-11T00:00:00Z")
    assert confirmed["text"] == "Polished wording."
    assert confirmed["original_text"] == "Original text."
    assert confirmed["user_edited"] is True
    assert confirmed["polished"] is True
    assert confirmed["finalized_at"] == "2026-06-11T00:00:00Z"
    assert confirmed["truth_guard_status"] == "needs_confirmation"
    assert confirmed["user_action"] == "pending"  # flows into the review queue
    assert "pending_edit" not in confirmed


def test_confirm_mine_keeps_user_wording() -> None:
    cv = _cv_with_bullet()
    stage_bullet_edit(cv, "b1", "My exact wording.", _pass_result())
    confirmed = confirm_bullet_edit(cv, "b1", "mine", now_iso="t")
    assert confirmed["text"] == "My exact wording."
    assert confirmed["polished"] is False


def test_confirm_cancel_restores_clean_state() -> None:
    cv = _cv_with_bullet()
    stage_bullet_edit(cv, "b1", "My edit.", _pass_result())
    bullet = confirm_bullet_edit(cv, "b1", "cancel", now_iso="t")
    assert bullet["text"] == "Original text."
    assert "pending_edit" not in bullet
    assert "finalized_at" not in bullet


def test_confirm_without_stage_returns_none() -> None:
    cv = _cv_with_bullet()
    assert confirm_bullet_edit(cv, "b1", "mine", now_iso="t") is None
    assert confirm_bullet_edit(cv, "ghost", "mine", now_iso="t") is None


# --- preservation merge -------------------------------------------------------------


def _finalized(text: str, bullet_id: str) -> dict:
    return {
        "id": bullet_id,
        "text": text,
        "source_evidence": "ev",
        "truth_guard_status": "safe_to_use",
        "keywords_used": [],
        "user_action": "pending",
        "user_edited": True,
        "polished": True,
        "finalized_at": "2026-06-11T00:00:00Z",
    }


def test_merge_carries_finalized_bullet_into_matching_entry() -> None:
    previous = _cv_with_bullet()
    previous["work_experience"][0]["bullets"][0] = _finalized("My confirmed bullet.", "old1")
    new_cv = _cv_with_bullet(text="Fresh model bullet.", bullet_id="new1")

    conflicts = merge_finalized_bullets(new_cv, previous)
    assert conflicts == []
    texts = [b["text"] for b in new_cv["work_experience"][0]["bullets"]]
    assert "My confirmed bullet." in texts
    carried = find_cv_json_bullet(new_cv, "old1")
    assert carried["finalized_at"]  # carried unchanged, id preserved


def test_merge_replaces_same_text_fresh_bullet_without_duplicating() -> None:
    previous = _cv_with_bullet()
    previous["work_experience"][0]["bullets"][0] = _finalized("Same  text here.", "old1")
    new_cv = _cv_with_bullet(text="Same text HERE.", bullet_id="new1")

    merge_finalized_bullets(new_cv, previous)
    bullets = new_cv["work_experience"][0]["bullets"]
    assert len(bullets) == 1
    assert bullets[0]["id"] == "old1"


def test_merge_restructured_entry_becomes_conflict_never_silent_loss() -> None:
    previous = _cv_with_bullet()
    previous["work_experience"][0]["bullets"][0] = _finalized("Kept work.", "old1")
    new_cv = {
        "work_experience": [
            {"company": "Globex", "title": "Lead", "bullets": []}
        ],
        "projects": [],
    }

    conflicts = merge_finalized_bullets(new_cv, previous)
    assert len(conflicts) == 1
    assert new_cv["preservation_conflicts"][0]["bullet"]["id"] == "old1"
    assert new_cv["preservation_conflicts"][0]["entry"]["company"] == "Acme"


def test_resolve_conflict_keep_recreates_the_entry() -> None:
    cv = {
        "work_experience": [{"company": "Globex", "title": "Lead", "bullets": []}],
        "projects": [],
        "preservation_conflicts": [
            {
                "section": "work_experience",
                "entry": {"company": "Acme", "title": "Engineer"},
                "bullet": _finalized("Kept work.", "old1"),
            }
        ],
    }
    assert resolve_preservation_conflict(cv, "old1", "keep")
    assert "preservation_conflicts" not in cv
    recreated = next(e for e in cv["work_experience"] if e.get("company") == "Acme")
    assert recreated["bullets"][0]["id"] == "old1"


def test_resolve_conflict_discard_drops_the_bullet() -> None:
    cv = {
        "work_experience": [],
        "projects": [],
        "preservation_conflicts": [
            {
                "section": "work_experience",
                "entry": {"company": "Acme", "title": "Engineer"},
                "bullet": _finalized("Kept work.", "old1"),
            }
        ],
    }
    assert resolve_preservation_conflict(cv, "old1", "discard")
    assert "preservation_conflicts" not in cv
    assert cv["work_experience"] == []
    assert not resolve_preservation_conflict(cv, "old1", "discard")  # already gone


# --- wired endpoints ----------------------------------------------------------------


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _authenticate() -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )


def _wire(monkeypatch: pytest.MonkeyPatch, data: FakeData) -> None:
    monkeypatch.setattr(
        "app.routers.draft_cvs.get_settings", lambda: make_settings(gemini_api_key="")
    )
    monkeypatch.setattr("app.routers.draft_cvs.SupabaseDataClient", lambda _s: data)


def _seed(data: FakeData, cv_json: dict, status: str = "ready_to_export") -> dict:
    return data.insert_draft_cv(
        user_profile_id="profile_1",
        match_id="match_1",
        job_id="job_1",
        resume_id="resume_1",
        title="Draft CV — Acme Engineer",
        status=status,
        cv_json=cv_json,
        cv_strategy_json={},
        quality_notes_json=[],
        confidence_score=0.8,
        provider="gemini",
        model_name="m",
    )


def _validated_cv(text: str = "Original text.") -> dict:
    out = DraftCvOutput.model_validate(
        {
            "candidate": {"full_name": "Dana"},
            "professional_summary": "Summary.",
            "work_experience": [
                {
                    "company": "Acme",
                    "title": "Engineer",
                    "bullets": [
                        {
                            "text": text,
                            "source_evidence": "ev",
                            "truth_guard_status": "safe_to_use",
                            "keywords_used": [],
                        }
                    ],
                }
            ],
        }
    )
    return assign_bullet_ids(out)


def test_patch_text_stages_pending_edit_and_keeps_old_text(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    row = _seed(data, _validated_cv())
    bullet_id = row["cv_json"]["work_experience"][0]["bullets"][0]["id"]
    _wire(monkeypatch, data)

    response = client.patch(
        f"/api/draft-cvs/{row['id']}/bullets/{bullet_id}/text",
        json={"text": "Built the FastAPI services."},
    )
    assert response.status_code == 200
    body = response.json()
    # Deterministic fallback: no polish, conservative status, a question to answer.
    assert body["polished_text"] == "Built the FastAPI services."
    assert body["truth_guard_status"] == "needs_confirmation"
    assert body["evidence_question"]

    bullet = find_cv_json_bullet(data.draft_cvs[-1]["cv_json"], bullet_id)
    assert bullet["pending_edit"]["user_text"] == "Built the FastAPI services."
    assert bullet["text"] == "Original text."  # still the previous, renderable text


def test_patch_text_unknown_bullet_is_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    row = _seed(data, _validated_cv())
    _wire(monkeypatch, data)

    response = client.patch(
        f"/api/draft-cvs/{row['id']}/bullets/ghost/text", json={"text": "X."}
    )
    assert response.status_code == 404


def test_confirm_mine_persists_choice_and_recomputes_status(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    row = _seed(data, _validated_cv())
    bullet_id = row["cv_json"]["work_experience"][0]["bullets"][0]["id"]
    _wire(monkeypatch, data)

    client.patch(
        f"/api/draft-cvs/{row['id']}/bullets/{bullet_id}/text",
        json={"text": "Built the FastAPI services."},
    )
    response = client.post(
        f"/api/draft-cvs/{row['id']}/bullets/{bullet_id}/text/confirm",
        json={"choice": "mine"},
    )
    assert response.status_code == 200

    saved = data.draft_cvs[-1]
    bullet = find_cv_json_bullet(saved["cv_json"], bullet_id)
    assert bullet["text"] == "Built the FastAPI services."
    assert bullet["original_text"] == "Original text."
    assert bullet["user_edited"] is True and bullet["polished"] is False
    assert bullet["finalized_at"]
    # needs_confirmation flows into the existing review queue -> needs_review.
    assert saved["status"] == "needs_review"


def test_confirm_without_pending_edit_is_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    row = _seed(data, _validated_cv())
    bullet_id = row["cv_json"]["work_experience"][0]["bullets"][0]["id"]
    _wire(monkeypatch, data)

    response = client.post(
        f"/api/draft-cvs/{row['id']}/bullets/{bullet_id}/text/confirm",
        json={"choice": "mine"},
    )
    assert response.status_code == 404


def test_preservation_resolve_endpoint_applies_keep(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    cv = _validated_cv()
    cv["preservation_conflicts"] = [
        {
            "section": "work_experience",
            "entry": {"company": "OldCo", "title": "Engineer"},
            "bullet": _finalized("Kept work.", "old1"),
        }
    ]
    row = _seed(data, cv)
    _wire(monkeypatch, data)

    response = client.post(
        f"/api/draft-cvs/{row['id']}/preservation/resolve",
        json={"bullet_id": "old1", "choice": "keep"},
    )
    assert response.status_code == 200
    saved = data.draft_cvs[-1]["cv_json"]
    assert "preservation_conflicts" not in saved
    assert any(e.get("company") == "OldCo" for e in saved["work_experience"])
