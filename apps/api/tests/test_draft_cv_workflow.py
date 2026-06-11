"""US-039 Draft CV tests: guards, fallback, status derivation, persistence.

No live model calls. Guard logic is tested as pure functions; the workflow is
tested through the US-027 foundation with the in-memory ``FakeData``.
"""

from __future__ import annotations

import json

import pytest
from ai_fakes import (
    RESUME_SECRET,
    FakeData,
    FakeGeminiClient,
    default_resume,
    gemini_valid_draft_cv,
    make_settings,
    profile_with_cv,
    rich_candidate_profile,
    saved_match_row,
    valid_draft_cv,
)

from app.schemas.draft_cv import DraftCvOutput
from app.services.ai.draft_cv_deterministic import build_draft_cv
from app.services.ai.draft_cv_logic import (
    apply_keyword_support_guard,
    apply_metrics_guard,
    apply_xyz_lint,
    assign_bullet_ids,
    derive_draft_status,
    run_guards,
)
from app.services.ai.draft_cv_workflow import DraftCvWorkflow
from app.services.ai.errors import (
    MissingMatchAnalysisError,
    MissingProfileError,
    UnauthorizedError,
)


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _data(**overrides) -> FakeData:
    params = {
        "saved_analysis_row": saved_match_row(),
        "profile": profile_with_cv(),
    }
    params.update(overrides)
    return FakeData(**params)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> DraftCvWorkflow:
    return DraftCvWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


def _saved_bullets(data: FakeData) -> list[dict]:
    cv = data.draft_cvs[-1]["cv_json"]
    bullets: list[dict] = []
    for section in ("work_experience", "projects"):
        for entry in cv.get(section, []):
            bullets.extend(entry.get("bullets", []))
    return bullets


# --- pre-flight guards ----------------------------------------------------------


def test_unauthorized_writes_no_run() -> None:
    data = _data(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.runs == []
    assert data.draft_cvs == []


def test_requires_saved_match_analysis() -> None:
    data = _data(saved_analysis_row=None)
    with pytest.raises(MissingMatchAnalysisError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.draft_cvs == []
    assert data.last_status == "failed"  # run row created then failed (foundation)


def test_requires_resume_text() -> None:
    resume = {"id": "resume_1", "title": "R", "raw_text": "  ", "structured_json": None}
    data = _data(resume=resume)
    with pytest.raises(MissingProfileError):
        _wf(data).run(subject_id="match_1", user_profile_id="profile_1")
    assert data.draft_cvs == []


# --- deterministic fallback -----------------------------------------------------


def test_deterministic_fallback_copies_verbatim_safe() -> None:
    data = _data()
    _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    row = data.draft_cvs[-1]
    assert row["provider"] == "deterministic"
    assert row["confidence_score"] == 0.0
    assert row["version"] == 1
    bullets = _saved_bullets(data)
    assert bullets, "fallback should produce bullets from the profile"
    assert all(b["truth_guard_status"] == "safe_to_use" for b in bullets)
    # Real metric preserved verbatim (38% is in the candidate's own resume).
    assert any("38%" in b["text"] for b in bullets)
    # Contact comes from the profile, never invented.
    assert row["cv_json"]["candidate"]["full_name"] == "Dana Engineer"
    # All-safe + confidence 0.0 -> needs_review.
    assert row["status"] == "needs_review"
    assert data.activities[-1]["activity_type"].startswith("draft_cv.")


# --- gemini path + server overrides ---------------------------------------------


def test_gemini_path_persists_draft() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    row = data.draft_cvs[-1]
    assert row["provider"] == "gemini"
    assert row["model_name"] == "gemini-2.5-flash"
    # One needs_confirmation bullet is still pending -> draft needs_review.
    assert row["status"] == "needs_review"
    assert any(b.get("id") for b in _saved_bullets(data))


def test_contact_and_target_job_overridden_server_side() -> None:
    data = _data()
    # The model guesses a wrong name/company; the server must overwrite both.
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    cv = data.draft_cvs[-1]["cv_json"]
    assert cv["candidate"]["full_name"] == "Dana Engineer"  # from profile, not "Model Guess"
    assert cv["candidate"]["email"] == "dana@example.com"
    assert cv["target_job"]["company"] == "Acme AI"  # from the job, not "Model Co"
    assert cv["target_job"]["title"] == "Senior AI Engineer"


def test_profile_location_preference_wins_over_resume_location() -> None:
    """The career profile's location is user-edited after import, so it must
    override the location extracted from the resume text."""
    profile = profile_with_cv()
    profile["location_preference"] = "Ho Chi Minh City, Vietnam"
    data = _data(profile=profile)
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    cv = data.draft_cvs[-1]["cv_json"]
    assert cv["candidate"]["location"] == "Ho Chi Minh City, Vietnam"


def test_resume_location_is_the_fallback_without_profile_preference() -> None:
    profile = profile_with_cv()
    profile["location_preference"] = None
    data = _data(profile=profile)
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    cv = data.draft_cvs[-1]["cv_json"]
    assert cv["candidate"]["location"] == "Remote US"  # from the imported resume


def test_profile_contact_email_and_phone_win_over_resume_values() -> None:
    """Like location, the profile's editable contact fields override what was
    extracted from the resume text."""
    profile = profile_with_cv()
    profile["contact_email"] = "dana.applies@example.com"
    profile["phone"] = "+1 619 555 0199"
    data = _data(profile=profile)
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    cv = data.draft_cvs[-1]["cv_json"]
    assert cv["candidate"]["email"] == "dana.applies@example.com"
    assert cv["candidate"]["phone"] == "+1 619 555 0199"


def test_resume_contact_is_the_fallback_without_profile_overrides() -> None:
    # profile_with_cv has no phone/contact_email set on the profile row.
    data = _data(profile=profile_with_cv())
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    cv = data.draft_cvs[-1]["cv_json"]
    assert cv["candidate"]["email"] == "dana@example.com"  # from the imported resume
    assert cv["candidate"]["phone"] == "555-0100"


def test_invented_metric_is_demoted() -> None:
    data = _data()
    poisoned = valid_draft_cv()
    poisoned["work_experience"][0]["bullets"] = [
        {
            "text": "Improved throughput by 47% across the platform.",
            "source_evidence": "throughput work",
            "truth_guard_status": "safe_to_use",  # model is optimistic; guard overrides
            "keywords_used": [],
        }
    ]
    client = FakeGeminiClient([gemini_valid_draft_cv(**poisoned)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    bullet = _saved_bullets(data)[0]
    assert bullet["truth_guard_status"] == "do_not_use_yet"  # 47 not in the resume
    notes = data.draft_cvs[-1]["quality_notes_json"]
    assert any(n["code"] == "invented_metric" for n in notes)


def test_unsupported_skill_excluded() -> None:
    data = _data()
    poisoned = valid_draft_cv()
    poisoned["skills"] = [
        {"category": "Programming Languages", "items": ["Python", "Kubernetes"]}
    ]
    client = FakeGeminiClient([gemini_valid_draft_cv(**poisoned)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    cv = data.draft_cvs[-1]["cv_json"]
    languages = next(g for g in cv["skills"] if g["category"] == "Programming Languages")
    assert "Python" in languages["items"]
    assert "Kubernetes" not in languages["items"]  # not in the resume corpus
    excluded = {e["keyword"] for e in data.draft_cvs[-1]["cv_strategy_json"]["keywords_excluded"]}
    assert "Kubernetes" in excluded


def test_many_weak_verbs_force_needs_review() -> None:
    data = _data()
    weak = valid_draft_cv(confidence_score=0.9)
    weak["work_experience"][0]["bullets"] = [
        {"text": "Responsible for backend services.", "source_evidence": "x",
         "truth_guard_status": "safe_to_use", "keywords_used": []},
        {"text": "The platform handled production workflows.", "source_evidence": "x",
         "truth_guard_status": "safe_to_use", "keywords_used": []},
        {"text": "Various Postgres schemas were maintained.", "source_evidence": "x",
         "truth_guard_status": "safe_to_use", "keywords_used": []},
    ]
    client = FakeGeminiClient([gemini_valid_draft_cv(**weak)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    assert data.last_status == "needs_review"  # > 2 weak-verb notes lowered confidence
    notes = data.draft_cvs[-1]["quality_notes_json"]
    assert sum(1 for n in notes if n["code"] == "weak_action_verb") >= 3


def test_regenerate_creates_a_new_version() -> None:
    data = _data()
    wf = _wf(data, key="")
    wf.run(subject_id="match_1", user_profile_id="profile_1")
    wf.run(subject_id="match_1", user_profile_id="profile_1", regenerate=True)

    assert [r["version"] for r in data.draft_cvs] == [1, 2]


def test_no_resume_secret_in_persisted_output() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_valid_draft_cv()])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    blob = json.dumps([data.draft_cvs, data.run_updates, data.activities])
    assert RESUME_SECRET not in blob  # the prompt holds the resume; outputs never do


# --- US-043 rendering recommendation + page policy --------------------------------


def test_rendering_json_persisted_and_clamped() -> None:
    """default_profile has 6y -> policy target 1 / max 2; a model asking for 3
    pages is clamped to 2 with a policy_clamped note, pre-clamp values kept."""
    data = _data()
    over = valid_draft_cv()
    over["rendering_recommendation"] = {
        "recommended_page_count": 3,
        "page_count_reason": "Lots of content.",
        "font_profile": "classic_latex",
        "layout_density": "compact",
        "compression_strategy": ["Prioritize backend work"],
    }
    client = FakeGeminiClient([gemini_valid_draft_cv(**over)])
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    row = data.draft_cvs[-1]
    rendering = row["rendering_json"]
    assert rendering["recommendation"]["recommended_page_count"] == 2  # clamped
    assert rendering["recommendation"]["font_profile"] == "classic_latex"
    assert rendering["model_recommendation"]["recommended_page_count"] == 3  # pre-clamp
    assert rendering["page_policy"]["target_pages"] == 1
    assert rendering["page_policy"]["max_pages"] == 2
    assert rendering["page_policy"]["yoe"] == 6.0
    assert any(n["code"] == "policy_clamped" for n in row["quality_notes_json"])
    # cv_json stays content-only.
    assert "rendering_recommendation" not in row["cv_json"]


def test_rendering_recommendation_in_range_is_untouched() -> None:
    data = _data()
    client = FakeGeminiClient([gemini_valid_draft_cv()])  # schema default: 1 page
    _wf(data, key="key", client=client).run(subject_id="match_1", user_profile_id="profile_1")

    row = data.draft_cvs[-1]
    assert row["rendering_json"]["recommendation"]["recommended_page_count"] == 1
    assert not any(n["code"] == "policy_clamped" for n in row["quality_notes_json"])


def test_fallback_rendering_recommendation_uses_policy_target() -> None:
    data = _data()
    _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    rendering = data.draft_cvs[-1]["rendering_json"]
    assert rendering["recommendation"]["recommended_page_count"] == 1  # policy target
    assert rendering["recommendation"]["font_profile"] == "modern_latex"
    assert "6 years of experience" in rendering["recommendation"]["page_count_reason"]
    assert rendering["model_recommendation"]["recommended_page_count"] == 1


def test_unknown_yoe_adds_quality_note() -> None:
    profile = profile_with_cv()
    profile["years_of_experience"] = None
    # Strip parseable dates so the span-parse also fails.
    for entry in profile["candidate_profile_json"]["work_experience"]:
        entry["start_date"] = "a while ago"
        entry["end_date"] = "recently"
    data = _data(profile=profile)
    _wf(data, key="").run(subject_id="match_1", user_profile_id="profile_1")

    row = data.draft_cvs[-1]
    assert row["rendering_json"]["page_policy"]["yoe_source"] == "unknown"
    assert any(n["code"] == "yoe_unknown" for n in row["quality_notes_json"])


def test_prompt_states_page_policy() -> None:
    data = _data()
    wf = _wf(data)
    context = wf.authorize(subject_id="match_1", user_profile_id="profile_1")
    prompt = wf.build_prompt(wf.load_input(context))
    assert "target 1 page(s), maximum 2" in prompt
    assert "rendering_recommendation" in prompt
    assert "6 years of experience" in prompt


# --- pure-function guard tests --------------------------------------------------


def _output(**overrides) -> DraftCvOutput:
    return DraftCvOutput.model_validate(valid_draft_cv(**overrides))


def test_metrics_guard_preserves_supported_demotes_invented() -> None:
    out = _output()
    out.work_experience[0].bullets[0].text = "Cut deployment time by 30%."
    out.work_experience[0].bullets[1].text = "Reduced costs by 80%."
    # Corpus supports 30 but not 80.
    notes = apply_metrics_guard(out, corpus="we cut it 30% last year")
    assert out.work_experience[0].bullets[0].truth_guard_status == "safe_to_use"
    assert out.work_experience[0].bullets[1].truth_guard_status == "do_not_use_yet"
    assert any(n.code == "invented_metric" for n in notes)


def test_metrics_guard_ignores_small_bare_integers() -> None:
    out = _output()
    out.work_experience[0].bullets[0].text = "Built 3 services for the team."
    notes = apply_metrics_guard(out, corpus="no numbers here at all")
    assert out.work_experience[0].bullets[0].truth_guard_status == "safe_to_use"
    assert not any(n.code == "invented_metric" for n in notes)


def test_keyword_guard_moves_unsupported_to_excluded() -> None:
    out = _output(skills=[{"category": "Backend", "items": ["FastAPI", "Rust"]}])
    notes = apply_keyword_support_guard(out, corpus="i use fastapi every day")
    items = out.skills[0].items
    assert items == ["FastAPI"]
    assert any(e.keyword == "Rust" for e in out.cv_strategy.keywords_excluded)
    assert any(n.code == "unsupported_keyword" for n in notes)


def test_xyz_lint_flags_weak_first_word() -> None:
    out = _output()
    out.work_experience[0].bullets[0].text = "Responsible for the API."
    out.work_experience[0].bullets[1].text = "Engineered the API."
    notes = apply_xyz_lint(out)
    assert sum(1 for n in notes if n.code == "weak_action_verb") == 1


def test_assign_bullet_ids_unique_and_pending() -> None:
    out = _output()
    cv = assign_bullet_ids(out)
    ids = [b["id"] for e in cv["work_experience"] for b in e["bullets"]]
    assert len(ids) == len(set(ids)) == 2
    assert all(
        b["user_action"] == "pending" for e in cv["work_experience"] for b in e["bullets"]
    )
    assert "cv_strategy" not in cv  # stored separately


def test_derive_draft_status_transitions() -> None:
    out = _output()
    cv = assign_bullet_ids(out)  # has one pending needs_confirmation bullet
    assert derive_draft_status(cv, 0.9) == "needs_review"

    # Approve the pending bullet -> ready_to_export.
    for e in cv["work_experience"]:
        for b in e["bullets"]:
            if b["truth_guard_status"] == "needs_confirmation":
                b["user_action"] = "approved"
    assert derive_draft_status(cv, 0.9) == "ready_to_export"
    # Low confidence keeps it in review even with nothing pending.
    assert derive_draft_status(cv, 0.3) == "needs_review"


def test_run_guards_sets_quality_notes() -> None:
    out = _output()
    out.work_experience[0].bullets[0].text = "Boosted revenue by 99%."
    notes = run_guards(out, corpus="nothing relevant")
    assert out.quality_notes == notes
    assert any(n.code == "invented_metric" for n in notes)


# --- deterministic builder ------------------------------------------------------


def test_build_draft_cv_prioritizes_only_supported_keywords() -> None:
    cv = build_draft_cv(
        candidate_profile=rich_candidate_profile(),
        job_title="Senior AI Engineer",
        company="Acme AI",
        source_url="https://jobs.example/role",
        job_keywords=["Python", "Kubernetes"],
    )
    assert cv["cv_strategy"]["keywords_prioritized"] == ["Python"]  # Kubernetes unsupported
    assert cv["confidence_score"] == 0.0
    assert cv["candidate"]["full_name"] == "Dana Engineer"
    bullets = [b for e in cv["work_experience"] for b in e["bullets"]]
    assert all(b["truth_guard_status"] == "safe_to_use" for b in bullets)
    assert any("38%" in b["text"] for b in bullets)


def test_build_draft_cv_clips_long_bullets() -> None:
    profile = rich_candidate_profile()
    profile["work_experience"][0]["bullet_points"] = ["x" * 400]
    cv = build_draft_cv(
        candidate_profile=profile,
        job_title="Role",
        company="Co",
        source_url=None,
        job_keywords=[],
    )
    text = cv["work_experience"][0]["bullets"][0]["text"]
    assert len(text) <= 240
    # And the schema accepts the fallback output.
    DraftCvOutput.model_validate(cv)


def test_default_resume_corpus_supports_fixture_skills() -> None:
    # Guard against fixture drift: the happy-path skills must be in the resume.
    text = default_resume()["raw_text"].lower()
    for skill in ("python", "fastapi", "postgres", "aws", "docker"):
        assert skill in text
