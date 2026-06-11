"""US-047 decision engine unit matrix (pure functions, no I/O).

Proves the frozen rules (0015 §2), the affinity heuristic (§3), the placement
table (§4), absent-input defaults, the nine confidence codes, and determinism.
The role-family cases here ARE the normative affinity fixture matrix.
"""

from __future__ import annotations

import pytest

from app.services.decision_adapters import (
    build_decision_inputs,
    derive_tailoring_signal,
    normalize_truth_guard,
    parse_gaps,
)
from app.services.decision_engine import (
    DISPLAY_LABELS,
    DecisionInputs,
    GapInput,
    decide,
    is_directionally_relevant,
)

_SUB = {"skill": 70, "experience": 60, "ai_readiness": 55, "ats_keywords": 65, "seniority": 60}


def make_inputs(**overrides) -> DecisionInputs:
    base = dict(
        overall_score=70,
        sub_scores=dict(_SUB),
        gaps=(),
        risk_level="low",
        tailoring_signal="unknown",
        user_asserted_relevance=False,
        target_role="AI Engineer",
        current_role="Software Engineer",
        technical_background="Python, FastAPI, AWS",
        job_title="AI Engineer",
        job_url="https://example.com/job",
        application_status=None,
        has_roadmap=False,
        has_draft_cv=False,
        has_suggestions=False,
        match_confidence=0.8,
        missing_skills_confidence=0.8,
        insight_confidence=0.8,
    )
    base.update(overrides)
    return DecisionInputs(**base)


def crit_gap(skill="RAG") -> GapInput:
    return GapInput(skill=skill, importance="critical", gap_type="true_gap", evidence_status="no_evidence")


def important_gap(skill="Kafka") -> GapInput:
    return GapInput(skill=skill, importance="medium", gap_type="true_gap", evidence_status="no_evidence")


def nice_gap(skill="Terraform") -> GapInput:
    return GapInput(skill=skill, importance="nice_to_have", gap_type="true_gap", evidence_status="no_evidence")


# --- Ordered rules + band boundaries (first match wins) -------------------------


@pytest.mark.parametrize(
    "score,expected",
    [
        (34, "not_recommended"),  # below floor
        (35, "learning_target"),  # band opens (relevant)
        (59, "learning_target"),
        (60, "apply_with_improvements"),  # mid band, clean
        (79, "apply_with_improvements"),
        (80, "strong_apply"),  # strong carved out of >=80
    ],
)
def test_band_boundaries_clean(score, expected):
    result = decide(make_inputs(overall_score=score, risk_level="low", tailoring_signal="safe"))
    assert result.label == expected


def test_band_35_not_relevant_is_not_recommended():
    result = decide(
        make_inputs(overall_score=45, target_role="Marketing Manager", current_role="", job_title="AI Engineer")
    )
    assert result.label == "not_recommended"
    assert result.reason_kind == "not_relevant"


def test_rule1_unsafe_tailoring_beats_high_score():
    result = decide(make_inputs(overall_score=95, tailoring_signal="unsafe"))
    assert result.label == "not_recommended"
    assert result.reason_kind == "unsafe_tailoring"
    assert result.material_readiness.draft_cv == "not_recommended"


def test_rule1_critical_gap_plus_high_risk_is_not_recommended():
    result = decide(make_inputs(overall_score=85, gaps=(crit_gap(),), risk_level="high"))
    assert result.label == "not_recommended"
    assert result.reason_kind == "critical_high_risk"


def test_rule4_score_wins_at_60_with_critical_gap():
    # restatement #14: name the gap, warn at generation, do NOT gatekeep.
    result = decide(make_inputs(overall_score=72, gaps=(crit_gap("Kubernetes"),), risk_level="low"))
    assert result.label == "apply_with_improvements"
    assert result.reason_kind == "critical_gap_apply"
    assert "Kubernetes" in result.summary
    assert result.material_readiness.draft_cv == "allowed_with_warning"


def test_rule4_cap_holds_even_with_suggestions():
    result = decide(
        make_inputs(overall_score=82, gaps=(crit_gap(),), risk_level="low", has_suggestions=True)
    )
    assert result.label == "apply_with_improvements"
    assert result.material_readiness.draft_cv == "allowed_with_warning"


def test_rule5_strong_apply_requires_clean_high_band():
    result = decide(make_inputs(overall_score=88, gaps=(), risk_level="medium", tailoring_signal="safe"))
    assert result.label == "strong_apply"
    assert result.material_readiness.draft_cv == "recommended"


def test_rule6_high_band_with_important_gap_is_apply_with_improvements():
    result = decide(make_inputs(overall_score=90, gaps=(important_gap(),), risk_level="low"))
    assert result.label == "apply_with_improvements"
    assert result.reason_kind == "important_gap_apply"


def test_rule6_high_risk_alone_carries_risk_reason_not_gap_copy():
    # restatement #15: gap-free high-risk softened to apply_with_improvements.
    result = decide(make_inputs(overall_score=85, gaps=(), risk_level="high", tailoring_signal="safe"))
    assert result.label == "apply_with_improvements"
    assert result.reason_kind == "high_risk_alone"
    assert "risk" in result.summary.lower()


def test_nice_to_have_gap_never_affects_label():
    result = decide(make_inputs(overall_score=85, gaps=(nice_gap(),), risk_level="low", tailoring_signal="safe"))
    assert result.label == "strong_apply"


def test_learning_band_names_critical_gap_without_changing_label():
    result = decide(
        make_inputs(overall_score=50, gaps=(crit_gap("RAG"),), risk_level="medium", target_role="AI Engineer")
    )
    assert result.label == "learning_target"


def test_all_four_labels_are_reachable():
    labels = {
        decide(make_inputs(overall_score=88, gaps=(), risk_level="low", tailoring_signal="safe")).label,
        decide(make_inputs(overall_score=72, gaps=(crit_gap(),))).label,
        decide(make_inputs(overall_score=50, target_role="AI Engineer")).label,
        decide(make_inputs(overall_score=20)).label,
    }
    assert labels == {"strong_apply", "apply_with_improvements", "learning_target", "not_recommended"}


# --- Absent-input defaults (the common fresh-analysis case, 0015 §2) ------------


def test_unknown_tailoring_does_not_block_strong_apply():
    result = decide(make_inputs(overall_score=85, gaps=(), risk_level="low", tailoring_signal="unknown"))
    assert result.label == "strong_apply"


def test_default_medium_risk_still_allows_strong_apply():
    result = decide(make_inputs(overall_score=85, gaps=(), risk_level="medium", tailoring_signal="unknown"))
    assert result.label == "strong_apply"


def test_confidence_is_mean_of_available_modules():
    result = decide(
        make_inputs(match_confidence=0.9, missing_skills_confidence=0.6, insight_confidence=None)
    )
    assert result.confidence.score == pytest.approx(0.75)


def test_confidence_none_when_no_module_confidences():
    result = decide(make_inputs(match_confidence=None, missing_skills_confidence=None, insight_confidence=None))
    assert result.confidence.score is None


# --- Affinity heuristic — the normative role-family fixture matrix (§3) ---------


@pytest.mark.parametrize(
    "job_title,target_role,current_role,expected",
    [
        ("Senior AI Engineer", "AI Engineer", "", True),  # target overlap
        ("Senior AI Engineer", "", "Software Engineer", True),  # current fallback, engineering overlap
        ("Data Scientist", "AI Engineer", "", True),  # scientist ∈ ai family
        ("Frontend Developer", "Backend Engineer", "", True),  # engineering overlap
        ("Marketing Manager", "AI Engineer", "", False),  # no family overlap
        ("AI Engineer", "", "", False),  # no reference role at all
    ],
)
def test_affinity_matrix(job_title, target_role, current_role, expected):
    assert (
        is_directionally_relevant(
            make_inputs(job_title=job_title, target_role=target_role, current_role=current_role)
        )
        is expected
    )


def test_user_asserted_relevance_always_wins():
    # Non-overlapping role, but the user explicitly saved it as a learning target.
    assert is_directionally_relevant(
        make_inputs(job_title="Marketing Manager", target_role="AI Engineer", user_asserted_relevance=True)
    )


def test_learnable_gap_lean_via_technical_background():
    relevant = is_directionally_relevant(
        make_inputs(
            job_title="Backend Engineer",
            target_role="",
            current_role="Data Analyst",
            technical_background="backend services and APIs",
            gaps=(GapInput("Phrasing", "medium", "wording_gap", "weak_evidence"),),
        )
    )
    assert relevant is True


def test_no_target_role_drives_not_recommended_and_reason():
    result = decide(make_inputs(overall_score=50, target_role="", current_role=""))
    assert result.label == "not_recommended"
    assert "no_target_role" in result.confidence.reasons


# --- Material readiness ----------------------------------------------------------


def test_material_readiness_per_label():
    strong = decide(make_inputs(overall_score=88, risk_level="low", tailoring_signal="safe"))
    assert (strong.material_readiness.draft_cv, strong.material_readiness.cover_letter) == (
        "recommended",
        "recommended",
    )

    awi_ready = decide(make_inputs(overall_score=70, has_suggestions=True))
    assert awi_ready.material_readiness.draft_cv == "recommended"

    awi_unreviewed = decide(make_inputs(overall_score=70, has_suggestions=False))
    assert awi_unreviewed.material_readiness.draft_cv == "allowed_with_warning"

    learning = decide(make_inputs(overall_score=50, target_role="AI Engineer"))
    assert learning.material_readiness.draft_cv == "allowed_with_warning"


# --- Next actions / placement table (§4) ----------------------------------------

_AGENCY = {"open_apply_link", "save_to_tracker", "save_learning_target", "generate_roadmap", "prepare_interview"}


@pytest.mark.parametrize(
    "result",
    [
        decide(make_inputs(overall_score=88, risk_level="low", tailoring_signal="safe")),
        decide(make_inputs(overall_score=72, gaps=(crit_gap(),))),
        decide(make_inputs(overall_score=50, target_role="AI Engineer")),
        decide(make_inputs(overall_score=20)),
    ],
)
def test_agency_actions_present_for_every_label(result):
    types = {a.type for a in result.next_actions}
    assert _AGENCY <= types, f"{result.label} missing {_AGENCY - types}"


def test_refresh_is_in_no_action_tier():
    for score in (88, 72, 50, 20):
        result = decide(make_inputs(overall_score=score, target_role="AI Engineer"))
        assert all("refresh" not in a.type for a in result.next_actions)


def test_open_apply_link_omitted_without_job_url():
    result = decide(make_inputs(overall_score=88, job_url=None, risk_level="low", tailoring_signal="safe"))
    assert all(a.type != "open_apply_link" for a in result.next_actions)


def test_draft_cv_locked_until_strategy_for_apply_with_improvements():
    locked = decide(make_inputs(overall_score=70, has_suggestions=False))
    draft = next(a for a in locked.next_actions if a.type == "generate_draft_cv")
    assert draft.placement == "primary" and draft.state == "locked"

    enabled = decide(make_inputs(overall_score=70, has_suggestions=True))
    draft2 = next(a for a in enabled.next_actions if a.type == "generate_draft_cv")
    assert draft2.placement == "primary" and draft2.state == "enabled"


def test_generate_roadmap_flips_to_view_when_one_exists():
    result = decide(make_inputs(overall_score=50, target_role="AI Engineer", has_roadmap=True))
    roadmap = next(a for a in result.next_actions if a.type == "generate_roadmap")
    assert roadmap.state == "done" and "View" in roadmap.label


def test_tracker_live_application_suppresses_shop_around_and_promotes_interview():
    result = decide(make_inputs(overall_score=20, application_status="interviewing"))
    types = [a.type for a in result.next_actions]
    assert "find_better_matches" not in types
    assert "save_reference" not in types
    prepare = next(a for a in result.next_actions if a.type == "prepare_interview")
    assert prepare.placement == "primary"


def test_update_profile_promoted_when_profile_incomplete():
    result = decide(
        make_inputs(overall_score=50, target_role="AI Engineer", profile_incomplete=True)
    )
    update = next(a for a in result.next_actions if a.type == "update_profile")
    assert update.placement == "primary"


# --- Confidence reason codes (all nine) -----------------------------------------


def test_all_nine_confidence_codes_derive_from_their_cause():
    result = decide(
        make_inputs(
            target_role="",
            current_role="",
            profile_incomplete=True,
            job_description_short=True,
            job_not_extracted=True,
            requirements_ambiguous=True,
            used_deterministic_fallback=True,
            failed_modules=("missing_skills",),
            module_output_partial=True,
            missing_modules=("assistant_insight",),
        )
    )
    assert set(result.confidence.reasons) == {
        "profile_incomplete",
        "no_target_role",
        "job_description_short",
        "job_not_extracted",
        "requirements_ambiguous",
        "deterministic_fallback",
        "module_failed",
        "module_output_partial",
        "module_missing",
    }


def test_header_confidence_is_qualitative_not_a_number():
    result = decide(make_inputs(profile_incomplete=True))
    assert any(ch.isalpha() for ch in result.confidence.qualitative)
    assert "%" not in result.confidence.qualitative


# --- Display labels + determinism + clean copy ----------------------------------


def test_display_label_mapping_complete():
    assert set(DISPLAY_LABELS) == {
        "strong_apply",
        "apply_with_improvements",
        "learning_target",
        "not_recommended",
    }
    for label, display in DISPLAY_LABELS.items():
        assert display and display != label


def test_same_inputs_yield_identical_result():
    a = decide(make_inputs(overall_score=72, gaps=(crit_gap(),)))
    b = decide(make_inputs(overall_score=72, gaps=(crit_gap(),)))
    assert a == b


def test_summary_has_no_module_or_provider_vocabulary():
    for score in (88, 72, 50, 20):
        result = decide(make_inputs(overall_score=score, target_role="AI Engineer", gaps=(crit_gap(),)))
        lowered = result.summary.lower()
        for banned in ("gemini", "deterministic", "workflow", "json", "module", "endpoint"):
            assert banned not in lowered


# --- Adapters --------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Safe to use", "safe_to_use"),
        ("safe_to_use", "safe_to_use"),
        ("Needs confirmation", "needs_confirmation"),
        ("Do not use yet", "do_not_use_yet"),
        ("do_not_use_yet", "do_not_use_yet"),
        ("", "needs_confirmation"),
        (None, "needs_confirmation"),
    ],
)
def test_normalize_truth_guard_both_casings(raw, expected):
    assert normalize_truth_guard(raw) == expected


def test_derive_tailoring_signal_tristate():
    assert derive_tailoring_signal(None) == "unknown"
    assert derive_tailoring_signal([]) == "unknown"
    assert derive_tailoring_signal([{"truth_guard_status": "Safe to use"}]) == "safe"
    assert (
        derive_tailoring_signal(
            [{"truth_guard_status": "Do not use yet"}, {"truth_guard_status": "do_not_use_yet"}]
        )
        == "unsafe"
    )
    assert (
        derive_tailoring_signal(
            [{"truth_guard_status": "Do not use yet"}, {"truth_guard_status": "Safe to use"}]
        )
        == "safe"
    )


def test_parse_gaps_maps_fields():
    gaps = parse_gaps(
        [{"skill": "RAG", "importance": "critical", "gap_type": "true_gap", "evidence_status": "no_evidence"}]
    )
    assert gaps == (GapInput("RAG", "critical", "true_gap", "no_evidence"),)
    assert parse_gaps(None) == ()


def test_build_inputs_absent_modules_set_defaults():
    inputs = build_decision_inputs(
        match_row={"overall_score": 82, "apply_recommendation": "apply_now", "analyzer_provider": "gemini"},
        missing_skills_row=None,
        insight_row=None,
        suggestion_rows=None,
        profile={"target_role": "AI Engineer", "technical_background": "Python"},
        job={"title": "AI Engineer", "parse_status": "parsed", "structured_json": {"requirements": ["x"]}},
        application=None,
        latest_runs=[],
    )
    assert inputs.risk_level == "medium"  # no insight row
    assert inputs.tailoring_signal == "unknown"  # no suggestions
    assert "assistant_insight" in inputs.missing_modules
    assert "missing_skills" in inputs.missing_modules


def test_build_inputs_deterministic_provider_flags_fallback():
    inputs = build_decision_inputs(
        match_row={"overall_score": 70, "apply_recommendation": "improve_first", "analyzer_provider": "deterministic"},
        missing_skills_row=None,
        insight_row=None,
        suggestion_rows=None,
        profile={"target_role": "AI Engineer", "technical_background": "Python"},
        job={"title": "AI Engineer", "parse_status": "parsed", "structured_json": {"skills": ["x"]}},
        application=None,
        latest_runs=[],
    )
    assert inputs.used_deterministic_fallback is True
