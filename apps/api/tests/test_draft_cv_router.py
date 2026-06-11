"""US-039/US-040/US-041/US-042 draft CV endpoint tests (TestClient).

Exercises the wired routes end to end against the in-memory FakeData: generate,
read, per-bullet review PATCH, export-preview, and PDF/DOCX export including the
empty-cv guard, export stamping, ownership, and activity writes.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from ai_fakes import FakeData, make_settings, profile_with_cv, saved_match_row
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.draft_cv import DraftCvOutput
from app.services.ai.draft_cv_logic import assign_bullet_ids


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


def _seed_cv_json(bullets: list[dict]) -> dict:
    out = DraftCvOutput.model_validate(
        {
            "candidate": {"full_name": "Dana Engineer"},
            "professional_summary": "Summary line.",
            "skills": [{"category": "Backend", "items": ["FastAPI"]}],
            "work_experience": [
                {"company": "Acme", "title": "Engineer", "bullets": bullets}
            ],
        }
    )
    return assign_bullet_ids(out)


def _seed_draft(
    data: FakeData,
    *,
    status: str,
    bullets: list[dict],
    confidence: float = 0.8,
    rendering_json: dict | None = None,
) -> dict:
    cv_json = _seed_cv_json(bullets)
    return data.insert_draft_cv(
        user_profile_id="profile_1",
        match_id="match_1",
        job_id="job_1",
        resume_id="resume_1",
        title="Draft CV — Acme Senior Engineer",
        status=status,
        cv_json=cv_json,
        cv_strategy_json={"keywords_prioritized": ["FastAPI"], "keywords_excluded": []},
        quality_notes_json=[],
        confidence_score=confidence,
        provider="gemini",
        model_name="gemini-2.5-flash",
        rendering_json=rendering_json,
    )


def _rendering_json(*, recommended: int = 1, max_pages: int = 2, font: str = "modern_latex") -> dict:
    return {
        "recommendation": {
            "recommended_page_count": recommended,
            "page_count_reason": "Concise one-pager.",
            "font_profile": font,
            "layout_density": "compact",
            "compression_strategy": [],
        },
        "page_policy": {
            "target_pages": recommended,
            "max_pages": max_pages,
            "yoe": 6.0,
            "yoe_source": "profile",
            "basis": "6 years of experience",
            "seniority_signal": None,
            "exceptional": False,
            "evidence_volume": 4,
            "notes": [],
        },
        "model_recommendation": {"recommended_page_count": recommended},
    }


def _bullet(text: str, status: str) -> dict:
    return {"text": text, "source_evidence": "ev", "truth_guard_status": status, "keywords_used": []}


# --- generate + read ------------------------------------------------------------


def test_generate_persists_and_get_returns_it(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData(saved_analysis_row=saved_match_row(), profile=profile_with_cv())
    _wire(monkeypatch, data)

    gen = client.post("/api/matches/match_1/draft-cv")
    assert gen.status_code == 200
    assert gen.json()["workflow_run"]["workflow_type"] == "draft_cv"
    assert len(data.draft_cvs) == 1

    got = client.get("/api/matches/match_1/draft-cv")
    assert got.status_code == 200
    body = got.json()
    assert body["draft_cv"]["version"] == 1
    assert len(body["versions"]) == 1


def test_get_draft_by_id_enforces_ownership(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="ready_to_export", bullets=[_bullet("Built X.", "safe_to_use")])
    data.draft_cvs[-1]["user_id"] = "someone_else"  # not the caller
    _wire(monkeypatch, data)

    response = client.get("/api/draft-cvs/draftcv_1")
    assert response.status_code == 404


# --- US-040 review PATCH --------------------------------------------------------


def test_patch_bullet_approve_flips_status_to_ready(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    row = _seed_draft(
        data,
        status="needs_review",
        bullets=[
            _bullet("Engineered safe services.", "safe_to_use"),
            _bullet("Designed plausible schemas.", "needs_confirmation"),
        ],
    )
    pending = next(
        b
        for b in row["cv_json"]["work_experience"][0]["bullets"]
        if b["truth_guard_status"] == "needs_confirmation"
    )
    _wire(monkeypatch, data)

    response = client.patch(
        f"/api/draft-cvs/draftcv_1/bullets/{pending['id']}",
        json={"user_action": "approved"},
    )
    assert response.status_code == 200
    assert response.json()["draft_cv"]["status"] == "ready_to_export"


def test_patch_unknown_bullet_is_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="needs_review", bullets=[_bullet("Built X.", "needs_confirmation")])
    _wire(monkeypatch, data)

    response = client.patch(
        "/api/draft-cvs/draftcv_1/bullets/does-not-exist", json={"user_action": "approved"}
    )
    assert response.status_code == 404


def test_patch_not_owned_is_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="needs_review", bullets=[_bullet("Built X.", "needs_confirmation")])
    data.draft_cvs[-1]["user_id"] = "someone_else"
    _wire(monkeypatch, data)

    response = client.patch(
        "/api/draft-cvs/draftcv_1/bullets/whatever", json={"user_action": "approved"}
    )
    assert response.status_code == 404
    assert data.draft_cv_updates == []


# --- US-041/US-042 export -------------------------------------------------------


def test_export_preview_reports_pending_and_notes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="needs_review",
        bullets=[
            _bullet("Engineered safe services.", "safe_to_use"),
            _bullet("Designed plausible schemas.", "needs_confirmation"),
        ],
    )
    _wire(monkeypatch, data)

    response = client.get("/api/draft-cvs/draftcv_1/export-preview")
    assert response.status_code == 200
    body = response.json()
    assert body["pending_review_count"] == 1
    assert body["render_model_summary"]["renderable_bullet_count"] == 1
    assert "export_notes" in body


def test_export_pdf_streams_and_stamps(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="ready_to_export", bullets=[_bullet("Built Approvedalpha.", "safe_to_use")])
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content[:5] == b"%PDF-"
    # Export stamped + status flipped + activity written.
    assert any("last_exported_pdf_at" in u for u in data.draft_cv_updates)
    assert data.draft_cvs[-1]["status"] == "exported"
    assert data.activities[-1]["activity_type"] == "draft_cv.exported"


def test_export_docx_streams(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="ready_to_export", bullets=[_bullet("Built Approvedalpha.", "safe_to_use")])
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/docx")
    assert response.status_code == 200
    assert "wordprocessingml" in response.headers["content-type"]
    assert response.content[:2] == b"PK"
    assert any("last_exported_docx_at" in u for u in data.draft_cv_updates)


def test_export_markdown_streams_and_stamps_status_only(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    cv_json = _seed_cv_json(
        [
            _bullet("Built Approvedalpha.", "safe_to_use"),
            _bullet("Improved Forbiddenepsilon throughput.", "do_not_use_yet"),
        ]
    )
    data.insert_draft_cv(
        user_profile_id="profile_1",
        match_id="match_1",
        job_id="job_1",
        resume_id="resume_1",
        title="Draft CV — Acme Senior Engineer",
        status="ready_to_export",
        cv_json=cv_json,
        cv_strategy_json={},
        quality_notes_json=[],
        confidence_score=0.8,
        provider="gemini",
        model_name="m",
    )
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/markdown")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert response.headers["content-disposition"].endswith('.md"')
    # Same gating boundary as PDF/DOCX: render-model output only.
    assert "Built Approvedalpha." in response.text
    assert "Forbiddenepsilon" not in response.text
    # draft_cvs has no markdown timestamp column: status flip + activity only.
    assert all(
        "last_exported_pdf_at" not in u and "last_exported_docx_at" not in u
        for u in data.draft_cv_updates
    )
    assert data.draft_cvs[-1]["status"] == "exported"
    assert data.activities[-1]["activity_type"] == "draft_cv.exported"


def test_export_empty_cv_is_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    # All content gated out + no summary -> nothing to export.
    cv_json = _seed_cv_json([_bullet("Improved Forbidden throughput.", "do_not_use_yet")])
    cv_json["professional_summary"] = ""
    data.insert_draft_cv(
        user_profile_id="profile_1",
        match_id="match_1",
        job_id="job_1",
        resume_id="resume_1",
        title="t",
        status="needs_review",
        cv_json=cv_json,
        cv_strategy_json={},
        quality_notes_json=[],
        confidence_score=0.8,
        provider="gemini",
        model_name="m",
    )
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "empty_cv"
    # Nothing exported -> no stamp, no activity.
    assert data.draft_cv_updates == []

    # The markdown route shares the same guard.
    response = client.post("/api/draft-cvs/draftcv_1/export/markdown")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "empty_cv"
    assert data.draft_cv_updates == []


# --- US-045 page override + rendering block -------------------------------------


def test_export_preview_includes_rendering_and_compression(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="ready_to_export",
        bullets=[_bullet("Built Approvedalpha services.", "safe_to_use")],
        rendering_json=_rendering_json(recommended=1, max_pages=2),
    )
    _wire(monkeypatch, data)

    response = client.get("/api/draft-cvs/draftcv_1/export-preview")
    assert response.status_code == 200
    rendering = response.json()["rendering"]
    assert rendering["has_recommendation"] is True
    assert rendering["recommended_pages"] == 1
    assert rendering["max_pages"] == 2
    assert rendering["font_profile"] == "modern_latex"
    assert rendering["font_embedded"] is True
    assert rendering["compression"] is not None
    assert rendering["compression"]["page_target"] == 1
    assert rendering["override_warning"] is None


def test_export_preview_legacy_row_has_no_compression(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="ready_to_export",
                bullets=[_bullet("Built X.", "safe_to_use")])  # no rendering_json
    _wire(monkeypatch, data)

    rendering = client.get("/api/draft-cvs/draftcv_1/export-preview").json()["rendering"]
    assert rendering["has_recommendation"] is False
    assert rendering["compression"] is None
    assert rendering["recommended_pages"] is None


def test_override_below_recommendation_warns(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="ready_to_export",
        bullets=[_bullet("Built Approvedalpha services.", "safe_to_use")],
        rendering_json=_rendering_json(recommended=2, max_pages=2),
    )
    _wire(monkeypatch, data)

    rendering = client.get("/api/draft-cvs/draftcv_1/export-preview?pages=1").json()["rendering"]
    assert rendering["override_warning"] is not None
    assert rendering["effective"]["page_target"] == 1


def test_override_out_of_range_is_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="ready_to_export",
        bullets=[_bullet("Built Approvedalpha.", "safe_to_use")],
        rendering_json=_rendering_json(recommended=1, max_pages=2),
    )
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf?pages=9")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_page_override"
    assert data.draft_cv_updates == []  # nothing exported


def test_override_on_legacy_row_is_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="ready_to_export",
                bullets=[_bullet("Built X.", "safe_to_use")])  # no rendering_json
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf?pages=2")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_rendering_recommendation"


def test_export_with_valid_override_streams(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="ready_to_export",
        bullets=[_bullet("Built Approvedalpha services.", "safe_to_use")],
        rendering_json=_rendering_json(recommended=1, max_pages=2),
    )
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf?pages=2")
    assert response.status_code == 200
    assert response.content[:5] == b"%PDF-"
    assert data.draft_cvs[-1]["status"] == "exported"


def test_font_override_changes_effective_font_and_lists_options(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The AI recommended ats_clean; ?font=modern_latex must win for this render
    (ephemeral, never persisted) and the preview must list the selectable fonts."""
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="ready_to_export",
        bullets=[_bullet("Built Approvedalpha services.", "safe_to_use")],
        rendering_json=_rendering_json(font="ats_clean"),
    )
    _wire(monkeypatch, data)

    rendering = client.get(
        "/api/draft-cvs/draftcv_1/export-preview?font=modern_latex"
    ).json()["rendering"]
    assert rendering["font_profile"] == "modern_latex"
    assert rendering["effective"]["font_profile"] == "modern_latex"
    assert rendering["font_display_name"] == "Modern LaTeX"
    assert {o["key"] for o in rendering["font_options"]} == {
        "modern_latex",
        "ats_clean",
        "classic_latex",
    }
    # Without the override the stored recommendation still governs.
    untouched = client.get("/api/draft-cvs/draftcv_1/export-preview").json()["rendering"]
    assert untouched["font_profile"] == "ats_clean"


def test_invalid_font_override_is_422(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _authenticate()
    data = FakeData()
    _seed_draft(
        data,
        status="ready_to_export",
        bullets=[_bullet("Built Approvedalpha.", "safe_to_use")],
        rendering_json=_rendering_json(),
    )
    _wire(monkeypatch, data)

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf?font=comic_sans")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_font_override"
    assert data.draft_cv_updates == []  # nothing exported


def test_font_override_works_on_legacy_rows_and_exports(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Legacy rows reject ``pages`` (no recommendation to bound it) but accept
    ``font`` — the font registry alone validates it."""
    _authenticate()
    data = FakeData()
    _seed_draft(data, status="ready_to_export",
                bullets=[_bullet("Built X.", "safe_to_use")])  # no rendering_json
    _wire(monkeypatch, data)

    rendering = client.get(
        "/api/draft-cvs/draftcv_1/export-preview?font=classic_latex"
    ).json()["rendering"]
    assert rendering["font_profile"] == "classic_latex"

    response = client.post("/api/draft-cvs/draftcv_1/export/pdf?font=classic_latex")
    assert response.status_code == 200
    assert response.content[:5] == b"%PDF-"


def test_unauthenticated_is_401(client: TestClient) -> None:
    app.dependency_overrides.clear()
    assert client.get("/api/draft-cvs/draftcv_1").status_code in (401, 403)
