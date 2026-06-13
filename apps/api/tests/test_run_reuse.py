"""US-067 version-keyed AI run reuse tests.

Unit tests pin the identity hash and the reuse decision matrix. Integration
tests drive a real workflow through ``BaseAIWorkflow.run`` to prove an unchanged
re-run performs zero provider calls and serves the persisted output, while an
input change, a model change, a prompt-version bump, or ``force_refresh`` each
force a true re-run.
"""

from __future__ import annotations

from typing import Any

from ai_fakes import FakeData, FakeGeminiClient, gemini_valid, make_settings

from app.schemas.ai_workflow import AIOutputBase
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.run_reuse import compute_identity_hash, is_reusable

MODEL = "gemini-2.5-flash"  # make_settings default; the default tier resolves to it


# --- identity hash --------------------------------------------------------------


def test_none_identity_disables_reuse() -> None:
    assert compute_identity_hash(None) is None


def test_same_identity_hashes_equal_and_is_order_independent() -> None:
    a = compute_identity_hash({"resume": "r1:t1", "job": "j1:t2"})
    b = compute_identity_hash({"job": "j1:t2", "resume": "r1:t1"})
    assert a is not None and a == b


def test_changing_any_input_flips_the_hash() -> None:
    base = compute_identity_hash({"resume": "r1:t1", "job": "j1:t1", "profile": "p1:t1"})
    assert compute_identity_hash({"resume": "r1:t2", "job": "j1:t1", "profile": "p1:t1"}) != base
    assert compute_identity_hash({"resume": "r1:t1", "job": "j1:t2", "profile": "p1:t1"}) != base
    assert compute_identity_hash({"resume": "r1:t1", "job": "j1:t1", "profile": "p1:t2"}) != base


# --- reuse decision matrix ------------------------------------------------------


def _prior(**overrides: Any) -> dict[str, Any]:
    base = {
        "status": "completed",
        "input_hash": "h1",
        "prompt_version": "v1",
        "model_name": MODEL,
    }
    base.update(overrides)
    return base


def test_reuse_when_all_match() -> None:
    assert is_reusable(_prior(), input_hash="h1", prompt_version="v1", model_name=MODEL)


def test_needs_review_prior_is_reusable() -> None:
    assert is_reusable(
        _prior(status="needs_review"), input_hash="h1", prompt_version="v1", model_name=MODEL
    )


def test_no_reuse_for_missing_or_unfinished_prior() -> None:
    assert not is_reusable(None, input_hash="h1", prompt_version="v1", model_name=MODEL)
    assert not is_reusable(
        _prior(status="failed"), input_hash="h1", prompt_version="v1", model_name=MODEL
    )
    assert not is_reusable(
        _prior(status="running"), input_hash="h1", prompt_version="v1", model_name=MODEL
    )


def test_no_reuse_on_any_key_mismatch() -> None:
    assert not is_reusable(_prior(), input_hash="h2", prompt_version="v1", model_name=MODEL)
    assert not is_reusable(_prior(), input_hash="h1", prompt_version="v2", model_name=MODEL)
    assert not is_reusable(_prior(), input_hash="h1", prompt_version="v1", model_name="other-model")


def test_null_hash_prior_never_reuses() -> None:
    # Historical rows (migrated null hash) are never a reusable match.
    assert not is_reusable(
        _prior(input_hash=None), input_hash="h1", prompt_version="v1", model_name=MODEL
    )


def test_none_current_hash_never_reuses() -> None:
    assert not is_reusable(_prior(), input_hash=None, prompt_version="v1", model_name=MODEL)


# --- integration: the run path reuses or re-runs --------------------------------


class _ReuseOutput(AIOutputBase):
    value: str = "ok"


class _ReuseStub(BaseAIWorkflow):
    """A real workflow whose reuse identity is settable, so the run-path reuse
    decision can be driven without depending on a concrete feature workflow."""

    workflow_type = "match_analysis"
    subject_type = "match"

    def __init__(self, *, identity: dict[str, Any], **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._identity = identity

    def authorize(self, *, subject_id, user_profile_id):
        return {"subject_id": subject_id}

    def load_input(self, context):
        return {"context": context}

    def build_prompt(self, data):
        return "PROMPT BODY"

    @property
    def output_model(self):
        return _ReuseOutput

    def deterministic_fallback(self, data):
        return {"value": "fb", "confidence_score": 0.9}

    def reuse_identity(self, context, data):
        return self._identity

    def persist(self, **kwargs):
        return None

    def build_activity(self, *, status, output, context):
        return ActivitySpec(activity_type=f"{self.workflow_type}.{status}", title="stub")

    # Keep the provider-call count crisp: the activity-description enrichment
    # would otherwise consume a second fake response on each non-cached run.
    def _write_activity(self, **kwargs):
        return None


def _run(stub: _ReuseStub, **kwargs: Any) -> dict[str, Any]:
    return stub.run(subject_id="match_1", user_profile_id="profile_1", **kwargs)


def test_unchanged_rerun_is_cached_with_zero_provider_calls() -> None:
    data = FakeData()
    client = FakeGeminiClient([gemini_valid(confidence_score=0.9)])  # exactly one response
    identity = {"resume": "r1:t1", "job": "j1:t1", "profile": "p1:t1"}

    first = _ReuseStub(
        identity=identity,
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    out1 = _run(first)
    assert out1["workflow_run"]["cached"] is False
    assert out1["workflow_run"]["model_provider"] == "gemini"
    assert client.models.calls == 1

    # Same subject + identity: the second run reuses the persisted result.
    calls_before = client.models.calls
    second = _ReuseStub(
        identity=identity,
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    out2 = _run(second)
    assert out2["workflow_run"]["cached"] is True
    assert client.models.calls == calls_before  # no provider call
    assert out2["result"] == out1["result"]


def test_input_change_forces_a_real_rerun() -> None:
    data = FakeData()
    client = FakeGeminiClient([gemini_valid(confidence_score=0.9), gemini_valid(confidence_score=0.8)])

    first = _ReuseStub(
        identity={"resume": "r1:t1"},
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    _run(first)
    assert client.models.calls == 1

    # Resume edited -> new updated_at -> different identity -> real re-run.
    second = _ReuseStub(
        identity={"resume": "r1:t2"},
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    out2 = _run(second)
    assert out2["workflow_run"]["cached"] is False
    assert client.models.calls == 2


def test_force_refresh_bypasses_reuse() -> None:
    data = FakeData()
    client = FakeGeminiClient([gemini_valid(confidence_score=0.9), gemini_valid(confidence_score=0.9)])
    identity = {"resume": "r1:t1"}

    first = _ReuseStub(
        identity=identity,
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    _run(first)

    second = _ReuseStub(
        identity=identity,
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    out2 = _run(second, force_refresh=True)
    assert out2["workflow_run"]["cached"] is False
    assert client.models.calls == 2  # forced through to the provider


def test_prompt_version_bump_invalidates_reuse() -> None:
    data = FakeData()
    client = FakeGeminiClient([gemini_valid(confidence_score=0.9), gemini_valid(confidence_score=0.9)])
    identity = {"resume": "r1:t1"}

    first = _ReuseStub(
        identity=identity,
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    _run(first)

    second = _ReuseStub(
        identity=identity,
        data_client=data,
        settings=make_settings(gemini_api_key="key", gemini_model=MODEL),
        gemini_client=client,
    )
    second.prompt_version = "v2"  # the workflow's prompt changed
    out2 = _run(second)
    assert out2["workflow_run"]["cached"] is False
    assert client.models.calls == 2


def test_no_reuse_attempt_without_a_model_key() -> None:
    # No key -> deterministic, no quota to save -> always runs (never cached).
    data = FakeData()
    stub = _ReuseStub(
        identity={"resume": "r1:t1"},
        data_client=data,
        settings=make_settings(gemini_api_key="", gemini_model=MODEL),
    )
    out = _run(stub)
    assert out["workflow_run"]["cached"] is False
    assert out["workflow_run"]["model_provider"] == "deterministic"
