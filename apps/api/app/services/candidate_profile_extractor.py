import time
from typing import Any, Protocol

from app.schemas.candidate_profile import CandidateProfileDraft
from app.services.ai.model_routing import resolve_model
from app.settings import Settings


class _GenerativeClient(Protocol):
    @property
    def models(self) -> Any: ...


class CandidateProfileExtractionError(RuntimeError):
    pass


class CandidateProfileServiceUnavailableError(CandidateProfileExtractionError):
    pass


def extract_candidate_profile_from_text(
    *,
    resume_text: str,
    settings: Settings,
) -> CandidateProfileDraft:
    if not settings.gemini_api_key:
        raise CandidateProfileExtractionError("Gemini API is not configured.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise CandidateProfileExtractionError("Gemini SDK is not installed.") from exc

    prompt = _build_prompt(resume_text)
    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=CandidateProfileDraft,
    )
    response = _generate_with_retry(
        client=client,
        model=resolve_model("candidate_profile_extraction", settings),
        contents=prompt,
        config=config,
        max_attempts=settings.gemini_max_attempts,
        base_delay_seconds=settings.gemini_retry_base_delay_seconds,
    )

    try:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, CandidateProfileDraft):
            return parsed
        return CandidateProfileDraft.model_validate_json(response.text)
    except Exception as exc:
        raise CandidateProfileExtractionError("Candidate profile extraction returned invalid JSON.") from exc


def _generate_with_retry(
    *,
    client: _GenerativeClient,
    model: str,
    contents: str,
    config: Any,
    max_attempts: int,
    base_delay_seconds: float,
) -> Any:
    """Call Gemini, retrying transient 429/5xx/UNAVAILABLE errors with exponential backoff.

    Gemini flash models intermittently return ``503 UNAVAILABLE`` ("model
    experiencing high demand"). A single blip should not fail the request, so we
    retry the transient class and only surface a service-unavailable error once
    every attempt has been exhausted. Non-transient errors fail immediately.
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
                raise CandidateProfileExtractionError(
                    "Candidate profile extraction failed."
                ) from exc
            last_exc = exc
            if attempt < max_attempts:
                time.sleep(base_delay_seconds * (2 ** (attempt - 1)))

    raise CandidateProfileServiceUnavailableError(
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


def _build_prompt(resume_text: str) -> str:
    return f"""
You are extracting a structured software engineer candidate profile from resume text.

Rules:
- Use the resume text as the only source of truth.
- Do not invent companies, dates, skills, projects, metrics, education, certifications, URLs, or contact information.
- If a value is missing, return null or an empty array.
- Preserve the meaning of original resume bullets.
- Separate work experience from projects when the resume supports that distinction.
- Mark uncertain fields by adding their JSON field paths to confidence.low_confidence_fields.
- Return structured JSON only.

Resume text:
---
{resume_text}
---
"""
