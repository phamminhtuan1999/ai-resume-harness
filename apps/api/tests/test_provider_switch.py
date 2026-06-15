"""US-069 provider switch readiness tests.

Unit tests pin the factory: it resolves adapters by name, fails fast on an
unknown name, and a registered second adapter satisfies the contract (name /
model_name / generate -> dict). Integration tests drive a real workflow through
``BaseAIWorkflow.run`` with ``AI_PROVIDER=fake`` and prove the executing adapter
swaps — the run row records the fake provider — with NO change to any workflow
subclass, while Gemini stays byte-for-byte unchanged when unset.
"""

from __future__ import annotations

import pytest
from ai_fakes import FakeData, FakeGeminiClient, gemini_valid, make_settings

from app.schemas.ai_workflow import AIOutputBase
from app.services.ai.base_workflow import ActivitySpec, BaseAIWorkflow
from app.services.ai.providers import (
    ProviderConfigurationError,
    build_primary_provider,
    register_provider,
    registered_providers,
)


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


# --- a fake second adapter (the "second provider" we never ship live) -----------


class _FakeAdapter:
    name = "fake"

    def __init__(self, *, prompt, output_model, settings, model, client=None):
        self._output_model = output_model
        # A real second provider maps tiers to its OWN model namespace; the fake
        # reports a fixed id to prove the adapter's model_name is recorded.
        self.model_name = "fake-model-1"

    def generate(self) -> dict:
        # Returns a schema-shaped dict for whatever output model is requested,
        # confident enough to complete (not needs_review). Proves the contract
        # without a real model.
        return {**self._output_model().model_dump(mode="json"), "confidence_score": 0.9}


def _build_fake(*, prompt, output_model, settings, model, client=None):
    return _FakeAdapter(
        prompt=prompt, output_model=output_model, settings=settings, model=model, client=client
    )


@pytest.fixture
def fake_provider_registered() -> None:
    register_provider("fake", _build_fake)
    # No teardown: the registry is process-global and "fake" is harmless/idempotent.


# --- a minimal workflow, untouched by the provider switch -----------------------


class _StubOutput(AIOutputBase):
    value: str = "stub-value"


class _StubWorkflow(BaseAIWorkflow):
    workflow_type = "match_analysis"
    subject_type = "match"

    @property
    def output_model(self):
        return _StubOutput

    def authorize(self, *, subject_id, user_profile_id):
        return {"subject_id": subject_id}

    def load_input(self, context):
        return {"context": context}

    def build_prompt(self, data):
        return "PROMPT"

    def deterministic_fallback(self, data):
        return {"value": "fb", "confidence_score": 0.9}

    def persist(self, *, user_profile_id, subject_id, output, provider_name, status, context, data):
        self.persisted = {"provider": provider_name}

    def build_activity(self, *, status, output, context):
        return ActivitySpec(activity_type=f"match_analysis.{status}", title="stub")


# --- factory unit tests ---------------------------------------------------------


def test_unknown_provider_fails_fast() -> None:
    with pytest.raises(ProviderConfigurationError) as exc:
        build_primary_provider(
            prompt="p",
            output_model=_StubOutput,
            settings=make_settings(ai_provider="does-not-exist"),
            model="m",
        )
    assert "does-not-exist" in str(exc.value)


def test_gemini_is_registered_by_default() -> None:
    assert "gemini" in registered_providers()


def test_gemini_builder_returns_none_without_a_key() -> None:
    provider = build_primary_provider(
        prompt="p",
        output_model=_StubOutput,
        settings=make_settings(ai_provider="gemini", gemini_api_key=""),
        model="m",
    )
    assert provider is None  # not configured → base falls back to deterministic


def test_registered_adapter_satisfies_the_contract(fake_provider_registered) -> None:
    provider = build_primary_provider(
        prompt="p",
        output_model=_StubOutput,
        settings=make_settings(ai_provider="fake"),
        model="fake-model-1",
    )
    assert provider is not None
    assert provider.name == "fake"
    assert provider.model_name == "fake-model-1"
    assert provider.generate() == {"value": "stub-value", "confidence_score": 0.9}


# --- integration: AI_PROVIDER swaps the executing adapter ------------------------


def test_provider_switch_changes_executing_adapter(fake_provider_registered) -> None:
    data = FakeData()
    wf = _StubWorkflow(data_client=data, settings=make_settings(ai_provider="fake"))
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")

    # The fake adapter ran; the run row + envelope record its name, unchanged shape.
    assert result["workflow_run"]["model_provider"] == "fake"
    assert result["workflow_run"]["status"] == "completed"
    assert wf.persisted["provider"] == "fake"
    final = data.final_update
    assert final["model_provider"] == "fake"
    assert final["model_name"] == "fake-model-1"


def test_gemini_unchanged_when_provider_unset() -> None:
    data = FakeData()
    wf = _StubWorkflow(
        data_client=data,
        settings=make_settings(gemini_api_key="key"),  # ai_provider defaults to 'gemini'
        gemini_client=FakeGeminiClient([gemini_valid(confidence_score=0.9)]),
    )
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")
    assert result["workflow_run"]["model_provider"] == "gemini"


def test_unconfigured_fake_provider_does_not_break_the_flow(monkeypatch) -> None:
    # A provider that reports "not configured" (None) must leave the deterministic
    # fallback protecting the user flow.
    def _build_unconfigured(*, prompt, output_model, settings, model, client=None):
        return None

    register_provider("offline", _build_unconfigured)
    data = FakeData()
    wf = _StubWorkflow(data_client=data, settings=make_settings(ai_provider="offline"))
    result = wf.run(subject_id="match_1", user_profile_id="profile_1")
    assert result["workflow_run"]["model_provider"] == "deterministic"
