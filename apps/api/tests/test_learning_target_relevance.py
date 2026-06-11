"""US-052 learning-target relevance signal (decision 0015 §3 signal 1).

Once the tracker can store ``learning_target`` (migration 0021), the decision
adapter's user-asserted-relevance signal activates: a job the user explicitly
saved as a learning target is treated as directionally relevant on every later
recompute, so a weak score lands on ``learning_target`` rather than
``not_recommended`` — the user, not the token heuristic, owns their direction.
"""

from __future__ import annotations

from app.services.decision_adapters import build_decision_inputs
from app.services.decision_engine import decide

# A role with no role-family overlap with the profile target — the token
# heuristic alone would NOT call it relevant.
_UNRELATED_JOB = {"title": "Marketing Manager", "parse_status": "parsed", "structured_json": {"x": 1}}
_PROFILE = {"target_role": "AI Engineer", "technical_background": "Python"}
_WEAK_MATCH = {"overall_score": 45, "apply_recommendation": "improve_first", "analyzer_provider": "gemini"}


def _inputs(application):
    return build_decision_inputs(
        match_row=_WEAK_MATCH,
        missing_skills_row=None,
        insight_row={"risk_level": "low", "recommendation": "build_project_first"},
        suggestion_rows=None,
        profile=_PROFILE,
        job=_UNRELATED_JOB,
        application=application,
        latest_runs=[],
    )


def test_learning_target_application_asserts_relevance():
    inputs = _inputs({"status": "learning_target"})
    assert inputs.user_asserted_relevance is True


def test_other_statuses_do_not_assert_relevance():
    assert _inputs({"status": "saved"}).user_asserted_relevance is False
    assert _inputs({"status": "applied"}).user_asserted_relevance is False
    assert _inputs(None).user_asserted_relevance is False


def test_saved_learning_target_flips_weak_verdict_to_learning_target():
    # No learning-target save: an unrelated weak role is Not Recommended.
    without = decide(_inputs({"status": "saved"}))
    assert without.label == "not_recommended"

    # Saved as a learning target: the same weak role becomes a Learning Target.
    with_save = decide(_inputs({"status": "learning_target"}))
    assert with_save.label == "learning_target"
