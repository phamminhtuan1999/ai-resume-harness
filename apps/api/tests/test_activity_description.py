"""US-037 ActivityDescriptionHelper unit tests: enrich, fallback, never raise."""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    gemini_invalid,
    gemini_valid_activity_description,
    make_settings,
    saved_match_row,
    saved_missing_skills_row,
)

from app.services.ai.activity_description import (
    ActivityDescriptionHelper,
    ActivityDescriptionOutput,
    fallback_description,
)
from app.services.ai.roadmap_workflow import RoadmapWorkflow


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _fallback():
    return fallback_description(
        activity_type="match_analysis.completed",
        title="Spec title",
        assistant_description="Spec description.",
        importance="medium",
    )


def _helper(*, key: str = "key", client: object | None = None) -> ActivityDescriptionHelper:
    return ActivityDescriptionHelper(
        settings=make_settings(gemini_api_key=key), gemini_client=client
    )


def test_valid_gemini_output_enriches_fields() -> None:
    client = FakeGeminiClient([gemini_valid_activity_description()])
    result = _helper(client=client).generate(
        event_context={"activity_event": {"activity_type": "match_analysis.completed"}},
        fallback=_fallback(),
    )
    assert result.provider == "gemini"
    assert result.importance == "high"
    assert result.assistant_description.startswith("ApplyWise scored")


def test_invalid_json_twice_returns_fallback_without_raising() -> None:
    client = FakeGeminiClient([gemini_invalid(), gemini_invalid()])
    result = _helper(client=client).generate(
        event_context={"activity_event": {}}, fallback=_fallback()
    )
    assert result.provider == "deterministic"
    assert result.activity_title == "Spec title"
    assert result.assistant_description == "Spec description."
    assert result.importance == "medium"


def test_provider_error_returns_fallback() -> None:
    client = FakeGeminiClient([RuntimeError("boom"), RuntimeError("boom")])
    result = _helper(client=client).generate(
        event_context={"activity_event": {}}, fallback=_fallback()
    )
    assert result.provider == "deterministic"


def test_no_key_skips_model_entirely() -> None:
    client = FakeGeminiClient([])
    result = _helper(key="", client=client).generate(
        event_context={"activity_event": {}}, fallback=_fallback()
    )
    assert result.provider == "deterministic"
    assert client.models.calls == 0


def test_generated_text_is_sanitized_of_quote_artifacts() -> None:
    from ai_fakes import valid_activity_description

    client = FakeGeminiClient(
        [
            gemini_valid_activity_description(
                activity_title='ApplyWise summarized your job search "," health: weak.',
                assistant_description='Your gaps are  "RAG"  and evaluation .',
            )
        ]
    )
    result = _helper(client=client).generate(
        event_context={"activity_event": {}}, fallback=_fallback()
    )
    assert result.activity_title == "ApplyWise summarized your job search, health: weak."
    assert result.assistant_description == "Your gaps are RAG and evaluation."
    assert valid_activity_description()  # fixture still importable / unchanged


def test_generic_fallback_is_schema_valid() -> None:
    generic = fallback_description(activity_type="cover_letter.completed")
    ActivityDescriptionOutput.model_validate(
        {
            "activity_title": generic.activity_title,
            "assistant_description": generic.assistant_description,
            "importance": generic.importance,
        }
    )
    assert generic.activity_title == "Cover letter completed"
    assert generic.assistant_description == "ApplyWise completed a cover letter workflow."
    assert generic.importance == "low"
    # Vowel-initial workflow types get the right article.
    insight = fallback_description(activity_type="assistant_insight.completed")
    assert insight.assistant_description == "ApplyWise completed an assistant insight workflow."


# --- inline enrichment through a real workflow ---------------------------------------


def test_workflow_activity_is_enriched_when_description_model_succeeds() -> None:
    from ai_fakes import gemini_valid_roadmap

    data = FakeData(
        saved_analysis_row=saved_match_row(),
        missing_skills_row=saved_missing_skills_row(),
    )
    # Behavior 1: the roadmap output; behavior 2: the activity description.
    client = FakeGeminiClient(
        [gemini_valid_roadmap(), gemini_valid_activity_description()]
    )
    RoadmapWorkflow(
        data_client=data, settings=make_settings(gemini_api_key="key"), gemini_client=client
    ).run(subject_id="match_1", user_profile_id="profile_1")

    activity = data.activities[-1]
    assert activity["title"] == "Match Analysis — Senior AI Engineer"
    assert activity["importance"] == "high"
    assert activity["assistant_description"].startswith("ApplyWise scored")


def test_workflow_activity_falls_back_to_spec_text_when_description_fails() -> None:
    from ai_fakes import gemini_valid_roadmap

    data = FakeData(
        saved_analysis_row=saved_match_row(),
        missing_skills_row=saved_missing_skills_row(),
    )
    # Roadmap succeeds; the description attempt exhausts behaviors -> fallback.
    client = FakeGeminiClient([gemini_valid_roadmap()])
    RoadmapWorkflow(
        data_client=data, settings=make_settings(gemini_api_key="key"), gemini_client=client
    ).run(subject_id="match_1", user_profile_id="profile_1")

    activity = data.activities[-1]
    assert activity["title"].startswith("ApplyWise built a 4-week improvement roadmap")
    assert activity["assistant_description"]  # spec text preserved, row not dropped
