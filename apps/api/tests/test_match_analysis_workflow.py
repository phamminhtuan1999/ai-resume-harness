"""US-028 match analyzer tests: scoring contract, evidence rules, fallback mapping."""

from __future__ import annotations

import pytest
from ai_fakes import FakeData, FakeGeminiClient, gemini_valid, make_settings

from app.schemas.match_analysis import (
    MatchAnalysisOutput,
    reconcile_overall_score,
    score_to_label,
    score_to_recommendation,
)
from app.services.ai.match_analysis_workflow import MatchAnalysisWorkflow
from app.services.ai.match_deterministic import analyze_resume_job_fit


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


# --- scoring contract -----------------------------------------------------------


def test_overall_recomputed_exactly_from_weighted_subscores() -> None:
    out = MatchAnalysisOutput(
        skill_score=80,
        experience_score=60,
        ai_readiness_score=40,
        ats_keyword_score=100,
        seniority_score=20,
        overall_score=100,  # model's value must be ignored in favor of reconciliation
    )
    # 80*.30 + 60*.20 + 40*.25 + 100*.15 + 20*.10 = 24+12+10+15+2 = 63
    assert reconcile_overall_score(out) == 63


@pytest.mark.parametrize(
    "score,label",
    [
        (39, "Not recommended yet"),
        (40, "Weak match"),
        (59, "Weak match"),
        (60, "Possible match with gaps"),
        (74, "Possible match with gaps"),
        (75, "Good match"),
        (89, "Good match"),
        (90, "Strong match"),
    ],
)
def test_score_to_label_band_boundaries(score: int, label: str) -> None:
    assert score_to_label(score) == label


@pytest.mark.parametrize(
    "score,recommendation",
    [
        (10, "not_recommended"),
        (39, "not_recommended"),
        (40, "improve_first"),
        (59, "improve_first"),
        (60, "apply_with_improvements"),
        (74, "apply_with_improvements"),
        (75, "apply_now"),
        (95, "apply_now"),
    ],
)
def test_recommendation_present_for_each_band(score: int, recommendation: str) -> None:
    assert score_to_recommendation(score) == recommendation


# --- evidence + gap typing ------------------------------------------------------


def test_strength_without_evidence_is_dropped() -> None:
    out = MatchAnalysisOutput.model_validate(
        {
            "top_strengths": [
                {"strength": "Python", "resume_evidence": "Built Python services."},
                {"strength": "Made up", "resume_evidence": ""},
                {"strength": "Whitespace", "resume_evidence": "   "},
            ]
        }
    )
    assert [s.strength for s in out.top_strengths] == ["Python"]


def test_gap_type_preserved_through_validation() -> None:
    out = MatchAnalysisOutput.model_validate(
        {
            "top_gaps": [
                {"gap": "RAG", "gap_type": "true_gap"},
                {"gap": "Kafka", "gap_type": "wording_gap"},
                {"gap": "Mentoring", "gap_type": "proof_gap"},
            ]
        }
    )
    assert [g.gap_type for g in out.top_gaps] == ["true_gap", "wording_gap", "proof_gap"]


# --- deterministic fallback fidelity -------------------------------------------


def test_deterministic_fallback_maps_mjs_output_with_real_evidence() -> None:
    raw = analyze_resume_job_fit(
        resume_text="Python and FastAPI engineer. 6 years. Senior.",
        job_description="Senior AI Engineer needs Python, FastAPI, RAG, LLM. 5+ years.",
    )
    out = MatchAnalysisOutput.model_validate(raw)

    matched = {s.strength for s in out.top_strengths}
    assert "python" in matched and "fastapi" in matched
    # No invented evidence: every retained strength carries resume evidence.
    assert all(s.resume_evidence.strip() for s in out.top_strengths)
    # Skills required but absent become true gaps.
    gaps = {g.gap for g in out.top_gaps}
    assert "rag" in gaps and "llm" in gaps
    assert all(g.gap_type == "true_gap" for g in out.top_gaps)


def test_deterministic_fallback_overall_matches_weighting() -> None:
    raw = analyze_resume_job_fit(
        resume_text="Python FastAPI AWS Docker. 6 years. Senior.",
        job_description="Python FastAPI RAG LLM AWS. 5 years. Senior.",
    )
    out = MatchAnalysisOutput.model_validate(raw)
    assert out.overall_score == reconcile_overall_score(out)


# --- workflow postprocess + persistence ----------------------------------------


def test_workflow_recomputes_overall_and_derives_recommendation() -> None:
    # Gemini returns a deliberately inconsistent overall (99) and recommendation
    # (apply_now); the workflow must overwrite both from the reconciled score.
    data = FakeData()
    client = FakeGeminiClient(
        [
            gemini_valid(
                overall_score=99,
                apply_recommendation="apply_now",
                skill_score=40,
                experience_score=40,
                ai_readiness_score=40,
                ats_keyword_score=40,
                seniority_score=40,
                confidence_score=0.8,
            )
        ]
    )
    wf = MatchAnalysisWorkflow(
        data_client=data, settings=make_settings(gemini_api_key="key"), gemini_client=client
    )
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["result"]["overall_score"] == 40  # all sub-scores 40 → 40
    assert result["result"]["apply_recommendation"] == "improve_first"
    assert data.saved_analysis["overall_score"] == 40
    assert data.saved_analysis["apply_recommendation"] == "improve_first"


def test_workflow_persists_legacy_mirror_columns() -> None:
    data = FakeData()
    wf = MatchAnalysisWorkflow(data_client=data, settings=make_settings(gemini_api_key=""))
    wf.run(subject_id="match_1", user_profile_id="profile_1")

    saved = data.saved_analysis
    assert saved is not None
    # New + legacy columns both populated for backward compatibility.
    assert "top_strengths_json" in saved and "strengths_json" in saved
    assert "top_gaps_json" in saved and "missing_skills_json" in saved
    assert saved["explanation_json"]["analyzer"] == "deterministic"


def test_activity_title_reflects_score_band() -> None:
    data = FakeData()
    wf = MatchAnalysisWorkflow(data_client=data, settings=make_settings(gemini_api_key=""))
    wf.run(subject_id="match_1", user_profile_id="profile_1")

    activity = data.activities[-1]
    assert activity["activity_type"].startswith("match_analysis.")
    assert "%" in activity["title"]
    assert activity["related_match_id"] == "match_1"
