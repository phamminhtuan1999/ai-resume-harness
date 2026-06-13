import time
from typing import Any, Protocol

from app.schemas.job import JobExtraction
from app.services.ai.model_routing import resolve_model
from app.settings import Settings

# Cap the page content sent to the model. Job posts are short; the rest is
# navigation/boilerplate that only adds tokens and noise.
_MAX_MARKDOWN_CHARS = 24_000


class _GenerativeClient(Protocol):
    @property
    def models(self) -> Any: ...


class JobExtractionError(RuntimeError):
    pass


class JobExtractionServiceUnavailableError(JobExtractionError):
    pass


def extract_job_from_markdown(
    *,
    markdown: str,
    settings: Settings,
    client: _GenerativeClient | None = None,
) -> JobExtraction:
    if not settings.gemini_api_key and client is None:
        raise JobExtractionError("Gemini API is not configured.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise JobExtractionError("Gemini SDK is not installed.") from exc

    prompt = _build_prompt(markdown[:_MAX_MARKDOWN_CHARS])
    if client is None:
        client = genai.Client(api_key=settings.gemini_api_key)
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=JobExtraction,
    )
    response = _generate_with_retry(
        client=client,
        model=resolve_model("job_extraction", settings),
        contents=prompt,
        config=config,
        max_attempts=settings.gemini_max_attempts,
        base_delay_seconds=settings.gemini_retry_base_delay_seconds,
    )

    try:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, JobExtraction):
            return parsed
        return JobExtraction.model_validate_json(response.text)
    except Exception as exc:
        raise JobExtractionError("Job extraction returned invalid JSON.") from exc


def _generate_with_retry(
    *,
    client: _GenerativeClient,
    model: str,
    contents: str,
    config: Any,
    max_attempts: int,
    base_delay_seconds: float,
) -> Any:
    """Call Gemini, retrying transient 429/5xx/UNAVAILABLE errors with backoff.

    Mirrors the candidate-profile extractor: a single transient blip should not
    fail the import, so the transient class is retried and only surfaced as a
    service-unavailable error once attempts are exhausted. Non-transient errors
    fail immediately.
    """
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            if not _is_temporary_provider_error(exc):
                raise JobExtractionError("Job extraction failed.") from exc
            last_exc = exc
            if attempt < max_attempts:
                time.sleep(base_delay_seconds * (2 ** (attempt - 1)))

    raise JobExtractionServiceUnavailableError(
        "Gemini is temporarily unavailable. Try again later."
    ) from last_exc


def _is_temporary_provider_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in {429, 500, 502, 503, 504}:
        return True

    error_text = str(exc)
    return any(
        marker in error_text
        for marker in [
            "429 ",
            "500 ",
            "502 ",
            "503 ",
            "504 ",
            "RESOURCE_EXHAUSTED",
            "UNAVAILABLE",
            "DEADLINE_EXCEEDED",
        ]
    )


def _build_prompt(job_markdown: str) -> str:
    return f"""
You are extracting a structured job posting from fetched job-page content.

Rules:
- Use the page content as the only source of truth.
- Do not invent a company, title, location, salary, skills, or requirements.
- If a value is missing, return null or an empty array.
- work_type must be one of: remote, hybrid, onsite, or null if unstated.
- employment_type must be one of: full-time, contract, internship, or null if unstated.
- role_summary is a 2-4 sentence overview of the role in the posting's own
  words: what the role is, what the team does, and what the hire will own.
- about_company is the posting's short company introduction, when present.
- required_skills are must-have skills; preferred_skills are nice-to-have.
- ai_related_requirements captures LLM/ML/GenAI requirements when present.
- cloud_requirements captures AWS/GCP/Azure/Kubernetes-style requirements.
- benefits captures listed perks/benefits/compensation extras, one per item.
- raw_description is the cleaned, human-readable job description text.
- confidence_score is your 0..1 confidence that the page was a real job posting
  and the fields are accurate.
- Return structured JSON only.

Job page content:
---
{job_markdown}
---
"""
