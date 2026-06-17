"""US-072 AI Role Relevance classifier tests.

Unit tests cover the pre-filter keyword groups, threshold bucketing, the
deterministic fallback paths (insufficient data, non-AI, AI-related), and the
output schema. Integration tests drive ``AiRoleRelevanceWorkflow.run`` to verify
the ownership check, the run row, the deterministic fallback, the Gemini path,
and US-067 reuse (zero extra model calls on an unchanged re-run).
"""

from __future__ import annotations

import pytest
from ai_fakes import (
    FakeData,
    FakeGeminiClient,
    ai_job,
    gemini_valid_ai_role_relevance,
    make_settings,
    non_ai_job,
)

from app.schemas.ai_role_relevance import AiRoleRelevanceOutput, ai_relevance_label
from app.services.ai.ai_role_relevance_deterministic import deterministic_ai_relevance
from app.services.ai.ai_role_relevance_prefilter import compute_prefilter_score
from app.services.ai.ai_role_relevance_workflow import AiRoleRelevanceWorkflow
from app.services.ai.errors import UnauthorizedError

MODEL = "gemini-2.5-flash"


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ai.providers.time.sleep", lambda _s: None)


def _wf(data: FakeData, *, key: str = "", client: object | None = None) -> AiRoleRelevanceWorkflow:
    return AiRoleRelevanceWorkflow(
        data_client=data, settings=make_settings(gemini_api_key=key), gemini_client=client
    )


def _quiet_wf(data: FakeData, *, key: str, client: object) -> AiRoleRelevanceWorkflow:
    wf = _wf(data, key=key, client=client)
    wf._write_activity = lambda **_kwargs: None  # type: ignore[method-assign]
    return wf


# --- pre-filter -----------------------------------------------------------------


def test_prefilter_ai_job_scores_high() -> None:
    pre = compute_prefilter_score(ai_job())
    assert pre["pre_score"] >= 40
    assert pre["likely_ai_related"] is True
    assert "rag" in pre["keyword_hits"] or "llm" in pre["keyword_hits"]


def test_prefilter_non_ai_job_scores_low() -> None:
    pre = compute_prefilter_score(non_ai_job())
    assert pre["likely_ai_related"] is False
    assert pre["keyword_hits"] == []


def test_prefilter_llm_keywords_detected() -> None:
    job = {"title": "LLM Engineer", "raw_description": "You will work with LangChain and OpenAI APIs."}
    pre = compute_prefilter_score(job)
    assert pre["likely_ai_related"] is True
    assert len(pre["group_hits"]["llm"]) >= 1


def test_prefilter_rag_keywords_detected() -> None:
    job = {"title": "Backend Engineer", "raw_description": "Build RAG pipelines with pgvector and embeddings."}
    pre = compute_prefilter_score(job)
    assert pre["likely_ai_related"] is True
    assert pre["group_hits"]["rag"]


def test_prefilter_exclusion_signals_reduce_score() -> None:
    job = {
        "title": "Marketing Manager",
        "raw_description": "Sales and marketing campaigns. AI content reviewer and data entry tasks.",
    }
    pre = compute_prefilter_score(job)
    assert pre["pre_score"] < 30


def test_prefilter_empty_job_returns_zero() -> None:
    pre = compute_prefilter_score({})
    assert pre["pre_score"] == 0
    assert pre["likely_ai_related"] is False
    assert pre["keyword_hits"] == []


def test_prefilter_title_ai_bonus_boosts_score() -> None:
    job_with_title = {"title": "AI Engineer", "raw_description": "Build backend services."}
    job_no_title = {"title": "Backend Engineer", "raw_description": "Build backend services."}
    score_with = compute_prefilter_score(job_with_title)["pre_score"]
    score_without = compute_prefilter_score(job_no_title)["pre_score"]
    assert score_with > score_without


def test_prefilter_agents_group_detected() -> None:
    job = {"title": "Software Engineer", "raw_description": "Build AI agent workflows with multi-agent systems and tool calling."}
    pre = compute_prefilter_score(job)
    assert pre["group_hits"]["agents"]
    assert pre["likely_ai_related"] is True


# --- deterministic fallback -----------------------------------------------------


def test_deterministic_insufficient_data() -> None:
    job = {"title": "AI Engineer", "raw_description": "Short."}
    result = deterministic_ai_relevance(job)
    assert result["is_ai_related"] is False
    assert result["exclude_reason"] == "insufficient_job_data"
    assert result["ai_relevance_score"] == 0
    assert result["confidence_score"] < 0.5


def test_deterministic_non_ai_job() -> None:
    result = deterministic_ai_relevance(non_ai_job())
    assert result["is_ai_related"] is False
    assert result["exclude_reason"] == "not_ai_related"
    assert result["ai_relevance_score"] <= 55


def test_deterministic_ai_job_returns_valid_schema() -> None:
    result = deterministic_ai_relevance(ai_job())
    output = AiRoleRelevanceOutput(**result)
    assert output.is_ai_related is True
    assert 60 <= output.ai_relevance_score <= 84
    assert output.ai_role_category != "unknown"
    assert output.exclude_reason is None
    assert len(output.detected_ai_keywords) >= 1


def test_deterministic_ai_job_never_exceeds_84() -> None:
    result = deterministic_ai_relevance(ai_job())
    assert result["ai_relevance_score"] <= 84


# --- ai_relevance_label ---------------------------------------------------------


def test_relevance_label_thresholds() -> None:
    assert ai_relevance_label(100) == "strong"
    assert ai_relevance_label(75) == "strong"
    assert ai_relevance_label(74) == "possible"
    assert ai_relevance_label(60) == "possible"
    assert ai_relevance_label(59) == "hidden"
    assert ai_relevance_label(0) == "hidden"


# --- workflow (integration) -----------------------------------------------------


def test_workflow_unauthorized_when_job_not_owned() -> None:
    data = FakeData(owned=False)
    wf = _wf(data)
    with pytest.raises(UnauthorizedError):
        wf.run(subject_id="job_ai_1", user_profile_id="profile_1")


def test_workflow_deterministic_fallback_no_key() -> None:
    data = FakeData(job=ai_job())
    wf = _wf(data, key="")
    result = wf.run(subject_id="job_ai_1", user_profile_id="profile_1")
    assert result["workflow_run"]["model_provider"] == "deterministic"
    assert result["result"]["is_ai_related"] is True
    assert result["workflow_run"]["workflow_type"] == "ai_role_relevance"


def test_workflow_gemini_path() -> None:
    data = FakeData(job=ai_job())
    client = FakeGeminiClient([gemini_valid_ai_role_relevance()])
    wf = _quiet_wf(data, key="k", client=client)
    result = wf.run(subject_id="job_ai_1", user_profile_id="profile_1")
    assert result["workflow_run"]["status"] in ("completed", "needs_review")
    assert result["result"]["ai_role_category"] == "applied_ai_engineer"
    assert result["result"]["is_ai_related"] is True
    assert client.models.calls == 1


def test_workflow_reuse_no_extra_model_call() -> None:
    data = FakeData(job=ai_job())
    client = FakeGeminiClient([gemini_valid_ai_role_relevance()])
    wf = _quiet_wf(data, key="k", client=client)

    first = wf.run(subject_id="job_ai_1", user_profile_id="profile_1")
    second = wf.run(subject_id="job_ai_1", user_profile_id="profile_1")

    assert client.models.calls == 1  # reuse: only the first run calls the model
    assert second["workflow_run"]["cached"] is True
    assert second["result"] == first["result"]


def test_workflow_run_row_written() -> None:
    data = FakeData(job=ai_job())
    wf = _wf(data, key="")
    wf.run(subject_id="job_ai_1", user_profile_id="profile_1")
    assert len(data.runs) >= 1
    run = data.runs[0]
    assert run["workflow_type"] == "ai_role_relevance"
    assert run["subject_type"] == "job"
    assert run["subject_id"] == "job_ai_1"


def test_workflow_non_ai_job_deterministic() -> None:
    data = FakeData(job=non_ai_job())
    wf = _wf(data, key="")
    result = wf.run(subject_id="job_nai_1", user_profile_id="profile_1")
    assert result["result"]["is_ai_related"] is False
