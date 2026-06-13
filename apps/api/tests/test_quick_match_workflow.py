"""US-068 AI quick match tests.

Unit tests pin the deterministic pre-score signals (Python port parity with the
``.mjs`` scorer), the output schema, the "insufficient data" collapse, and the
server-side batch cap. Integration tests drive ``QuickMatchWorkflow.run`` to
prove ownership, the fast-tier run row, the deterministic fallback, a clean
gemini path, and US-067 reuse (an unchanged re-run makes zero provider calls).
"""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    default_profile,
    gemini_valid_quick_match,
    make_settings,
    structured_job,
)

from app.schemas.quick_match import QuickMatchOutput, quick_match_label
from app.services.ai.errors import UnauthorizedError
from app.services.ai.quick_match_deterministic import (
    compute_pre_score,
    deterministic_quick_match,
    select_auto_quick_match_jobs,
)
from app.services.ai.quick_match_workflow import QuickMatchWorkflow

MODEL = "gemini-2.5-flash"  # make_settings default tier resolves here


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> QuickMatchWorkflow:
    return QuickMatchWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


def _quiet_wf(data: FakeData, *, key: str, client: object) -> QuickMatchWorkflow:
    """A workflow whose activity-description enrichment is a no-op, so the gemini
    client's call count reflects ONLY the quick-match generation (the activity
    helper would otherwise consume a second response per run)."""
    wf = _wf(data, key=key, client=client)
    wf._write_activity = lambda **_kwargs: None  # type: ignore[method-assign]
    return wf


# --- deterministic pre-score signals --------------------------------------------


def _profile() -> dict:
    return {
        "target_role": "AI Engineer",
        "current_role": "Senior Software Engineer",
        "years_of_experience": 6,
        "technical_background": "Python, FastAPI, AWS",
        "location_preference": "Remote US",
    }


def test_strong_fit_scores_high() -> None:
    pre = compute_pre_score(profile=_profile(), job=structured_job())
    # Parity with job-prescore.mjs on the same input (all 3 listed skills known).
    assert pre["tier"] == "strong"
    assert pre["score"] == 96
    assert pre["signals"] == {"skills": 100, "title": 100, "seniority": 90, "location": 85}


def test_skill_mismatch_drags_the_score_down() -> None:
    job = structured_job(extraction_json={"required_skills": ["Rust", "Kubernetes", "Go"]})
    pre = compute_pre_score(profile=_profile(), job=job)
    assert pre["signals"]["skills"] == 0
    assert pre["tier"] in ("weak", "promising")


def test_seniority_penalty_when_underexperienced() -> None:
    junior = {**_profile(), "years_of_experience": 1}
    pre = compute_pre_score(profile=junior, job=structured_job())  # needs 5y
    assert pre["signals"]["seniority"] < 90


def test_remote_preference_mismatch_lowers_location() -> None:
    remote_seeker = {**_profile(), "location_preference": "remote"}
    onsite = structured_job(work_type="onsite", location="Berlin", extraction_json=None)
    pre = compute_pre_score(profile=remote_seeker, job=onsite)  # wants remote, job onsite
    assert pre["signals"]["location"] == 40


def test_no_structured_data_is_insufficient() -> None:
    pre = compute_pre_score(profile=_profile(), job={"title": "Mystery Role"})
    assert pre["tier"] == "insufficient"
    assert pre["score"] is None


# --- deterministic quick-match output (the typed fallback) ----------------------


def test_fallback_is_schema_valid_and_strong() -> None:
    out = deterministic_quick_match(profile=_profile(), job=structured_job())
    model = QuickMatchOutput.model_validate(out)
    assert model.likelihood == "strong"
    assert model.headline
    assert model.confidence_score >= 0.5


def test_insufficient_collapses_to_weak_with_low_confidence() -> None:
    out = deterministic_quick_match(profile=_profile(), job={"title": "Mystery Role"})
    assert out["likelihood"] == "weak"
    assert out["confidence_score"] < 0.5  # below the needs-review line — honest
    assert "enough detail" in out["headline"]


def test_label_is_honest_and_non_numeric() -> None:
    assert quick_match_label("strong") == "Likely a strong fit"
    assert quick_match_label("weak") == "Probably a long shot"


# --- server-side batch cap ------------------------------------------------------


def _ranked(n: int) -> list[dict]:
    return [{"id": f"job_{i}", "pre_score": i * 10} for i in range(n)]


def test_cap_bounds_to_top_n_strongest_first() -> None:
    selected = select_auto_quick_match_jobs(_ranked(9), limit=5)
    assert len(selected) == 5
    assert [j["id"] for j in selected] == ["job_8", "job_7", "job_6", "job_5", "job_4"]


def test_cap_of_zero_disables_auto_quick_match() -> None:
    assert select_auto_quick_match_jobs(_ranked(9), limit=0) == []


def test_unscored_jobs_sort_last_under_the_cap() -> None:
    jobs = [{"id": "a", "pre_score": None}, {"id": "b", "pre_score": 80}, {"id": "c", "pre_score": 30}]
    selected = select_auto_quick_match_jobs(jobs, limit=2)
    assert [j["id"] for j in selected] == ["b", "c"]


# --- integration: the standard run path -----------------------------------------


def test_unauthorized_writes_no_run() -> None:
    data = FakeData(owned=False)
    with pytest.raises(UnauthorizedError):
        _wf(data).run(subject_id="job_1", user_profile_id="profile_1")
    assert data.runs == []  # ownership checked before any run row


def test_deterministic_path_persists_run_and_activity() -> None:
    data = FakeData(job=structured_job(), profile=default_profile())
    result = _wf(data, key="").run(subject_id="job_1", user_profile_id="profile_1")

    assert data.last_status == "completed"
    run = data.runs[-1]
    assert run["workflow_type"] == "quick_match"
    assert run["subject_type"] == "job"
    assert result["result"]["likelihood"] in ("strong", "promising", "weak")
    assert result["workflow_run"]["model_provider"] == "deterministic"
    activity = data.activities[-1]
    assert activity["activity_type"].startswith("quick_match.")
    assert activity["related_job_id"] == "job_1"
    # No domain table: nothing persisted beyond the run snapshot.
    assert "output_snapshot_json" in run


def test_gemini_path_returns_model_preview() -> None:
    data = FakeData(job=structured_job(), profile=default_profile())
    client = FakeGeminiClient([gemini_valid_quick_match(likelihood="promising")])
    result = _quiet_wf(data, key="key", client=client).run(
        subject_id="job_1", user_profile_id="profile_1"
    )
    assert result["result"]["likelihood"] == "promising"
    assert result["workflow_run"]["model_provider"] == "gemini"
    # Fast tier resolves to the default model in this unconfigured deployment.
    assert result["workflow_run"]["model_name"] == MODEL
    assert data.runs[-1]["model_name"] == MODEL


def test_unchanged_rerun_reuses_without_a_model_call() -> None:
    data = FakeData(job=structured_job(), profile=default_profile())
    # Two valid responses available, but the second run must NOT consume one.
    client = FakeGeminiClient(
        [gemini_valid_quick_match(), gemini_valid_quick_match()]
    )
    wf = _quiet_wf(data, key="key", client=client)
    wf.run(subject_id="job_1", user_profile_id="profile_1")
    calls_after_first = client.models.calls

    second = wf.run(subject_id="job_1", user_profile_id="profile_1")
    assert client.models.calls == calls_after_first  # zero further provider calls
    assert second["workflow_run"]["cached"] is True


def test_force_refresh_bypasses_reuse() -> None:
    data = FakeData(job=structured_job(), profile=default_profile())
    client = FakeGeminiClient(
        [gemini_valid_quick_match(), gemini_valid_quick_match()]
    )
    wf = _quiet_wf(data, key="key", client=client)
    wf.run(subject_id="job_1", user_profile_id="profile_1")
    calls_after_first = client.models.calls

    wf.run(subject_id="job_1", user_profile_id="profile_1", force_refresh=True)
    assert client.models.calls == calls_after_first + 1  # a real re-run
