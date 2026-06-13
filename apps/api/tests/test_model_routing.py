"""US-066 task-based model routing tests.

Unit tests pin the task -> tier policy and the env-driven model resolution
(fast/default/heavy, with fallback to the default model). One integration test
proves a workflow run records the tier-resolved ``model_name`` on its run row.
"""

from __future__ import annotations

import pytest
from ai_fakes import FakeData, FakeGeminiClient, gemini_valid, make_settings

from app.schemas.ai_workflow import AIOutputBase
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.model_routing import TASK_TIER, resolve_model, resolve_tier

DEFAULT = "gemini-default"
FAST = "gemini-fast"
HEAVY = "gemini-heavy"


# --- tier policy ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("task", "tier"),
    [
        # Fast: short, low-stakes text.
        ("activity_description", "fast"),
        ("dashboard_summary", "fast"),
        ("assistant_insight", "fast"),
        ("quick_match", "fast"),
        # Default: analysis + generation + the standalone extractors.
        ("match_analysis", "default"),
        ("missing_skills", "default"),
        ("resume_suggestions", "default"),
        ("cover_letter", "default"),
        ("roadmap", "default"),
        ("interview_prep", "default"),
        ("job_extraction", "default"),
        ("candidate_profile_extraction", "default"),
        ("bullet_edit", "default"),
        # Heavy: opt-in upgrade for Draft CV generation only.
        ("draft_cv", "heavy"),
        ("resume_draft", "heavy"),
    ],
)
def test_every_task_maps_to_its_tier(task: str, tier: str) -> None:
    assert resolve_tier(task) == tier
    assert TASK_TIER[task] == tier


def test_unknown_task_falls_back_to_default_tier() -> None:
    assert resolve_tier("brand_new_task_not_in_policy") == "default"


# --- model resolution -----------------------------------------------------------


def test_default_tier_resolves_to_default_model() -> None:
    settings = make_settings(gemini_model=DEFAULT)
    assert resolve_model("match_analysis", settings) == DEFAULT


def test_unknown_task_resolves_to_default_model() -> None:
    settings = make_settings(gemini_model=DEFAULT, gemini_fast_model=FAST)
    assert resolve_model("brand_new_task", settings) == DEFAULT


def test_fast_tier_falls_back_to_default_when_unset() -> None:
    # No GEMINI_FAST_MODEL: current single-model deployments behave identically.
    settings = make_settings(gemini_model=DEFAULT, gemini_fast_model="")
    assert resolve_model("dashboard_summary", settings) == DEFAULT


def test_fast_tier_uses_fast_model_when_set() -> None:
    settings = make_settings(gemini_model=DEFAULT, gemini_fast_model=FAST)
    assert resolve_model("assistant_insight", settings) == FAST


def test_heavy_tier_uses_default_when_flag_off() -> None:
    # Heavy model configured but the opt-in flag is off -> default.
    settings = make_settings(
        gemini_model=DEFAULT,
        gemini_heavy_model=HEAVY,
        ai_use_heavy_model_for_draft_cv=False,
    )
    assert resolve_model("draft_cv", settings) == DEFAULT


def test_heavy_tier_uses_default_when_flag_on_but_no_heavy_model() -> None:
    settings = make_settings(
        gemini_model=DEFAULT,
        gemini_heavy_model="",
        ai_use_heavy_model_for_draft_cv=True,
    )
    assert resolve_model("draft_cv", settings) == DEFAULT


def test_heavy_tier_uses_heavy_model_when_flag_and_model_both_set() -> None:
    settings = make_settings(
        gemini_model=DEFAULT,
        gemini_heavy_model=HEAVY,
        ai_use_heavy_model_for_draft_cv=True,
    )
    assert resolve_model("draft_cv", settings) == HEAVY


def test_heavy_flag_does_not_leak_to_other_tasks() -> None:
    # The flag only upgrades the heavy tier; a default task stays on the default.
    settings = make_settings(
        gemini_model=DEFAULT,
        gemini_heavy_model=HEAVY,
        ai_use_heavy_model_for_draft_cv=True,
    )
    assert resolve_model("cover_letter", settings) == DEFAULT
    assert resolve_model("dashboard_summary", settings) == DEFAULT


# --- integration: the run row records the resolved model ------------------------


class _RoutedOutput(AIOutputBase):
    value: str = "ok"


def _make_workflow(workflow_type: str, **kwargs) -> BaseAIWorkflow:
    """A minimal real workflow whose only variable is its ``workflow_type`` —
    enough to drive tier resolution through the standard flow."""

    class _RoutedWorkflow(BaseAIWorkflow):
        subject_type = "match"

        def authorize(self, *, subject_id, user_profile_id):
            return {"subject_id": subject_id}

        def load_input(self, context):
            return {"context": context}

        def build_prompt(self, data):
            return "PROMPT BODY"

        @property
        def output_model(self):
            return _RoutedOutput

        def deterministic_fallback(self, data):
            return {"value": "fb", "confidence_score": 0.9}

        def persist(self, **kwargs):
            return None

        def build_activity(self, *, status, output, context):
            return ActivitySpec(activity_type=f"{self.workflow_type}.{status}", title="stub")

    _RoutedWorkflow.workflow_type = workflow_type  # type: ignore[assignment]
    return _RoutedWorkflow(**kwargs)


def test_run_records_fast_tier_model_name_on_the_run_row() -> None:
    data = FakeData()
    wf = _make_workflow(
        "dashboard_summary",
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=DEFAULT, gemini_fast_model=FAST),
        gemini_client=FakeGeminiClient([gemini_valid(confidence_score=0.9)]),
    )
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_provider"] == "gemini"
    assert result["workflow_run"]["model_name"] == FAST
    # The persisted run row carries the same resolved model.
    last_update = data.run_updates[-1][1]
    assert last_update["model_name"] == FAST


def test_run_records_default_tier_model_name_on_the_run_row() -> None:
    data = FakeData()
    wf = _make_workflow(
        "match_analysis",
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=DEFAULT, gemini_fast_model=FAST),
        gemini_client=FakeGeminiClient([gemini_valid(confidence_score=0.9)]),
    )
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    assert result["workflow_run"]["model_name"] == DEFAULT
