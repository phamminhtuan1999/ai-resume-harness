"""AI provider abstraction for the workflow foundation (US-027).

Two providers implement the same tiny contract:

- ``GeminiProvider`` wraps the structured-output + retry pattern already proven
  in ``job_extractor.py`` / ``candidate_profile_extractor.py``, extracted here as
  ``generate_structured`` so no extractor logic is duplicated.
- ``DeterministicFallbackProvider`` wraps a workflow-supplied generator that
  returns the same schema without calling a model.

Provider failures are raised as ``ProviderError`` subclasses so ``BaseAIWorkflow``
can decide whether to fall back or fail. The selection rule (Gemini when a key is
configured, else fallback; fallback also on terminal failure) lives in the base
workflow, not here.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Protocol, runtime_checkable

from pydantic import BaseModel, ValidationError

from app.settings import Settings

# Transient provider failures worth retrying with backoff. Mirrors the existing
# extractors so behavior is identical across all AI calls.
_RATE_LIMIT_STATUS = {429}
_TRANSIENT_STATUS = {429, 500, 502, 503, 504}
_RATE_LIMIT_MARKERS = ("429 ", "RESOURCE_EXHAUSTED")
_TIMEOUT_MARKERS = ("DEADLINE_EXCEEDED", "504 ", "timed out", "timeout")
_TRANSIENT_MARKERS = (
    "429 ",
    "500 ",
    "502 ",
    "503 ",
    "504 ",
    "RESOURCE_EXHAUSTED",
    "UNAVAILABLE",
    "DEADLINE_EXCEEDED",
)


class ProviderError(RuntimeError):
    """Base for provider failures the workflow may recover from via fallback."""

    reason_code = "network_failure"


class ProviderUnavailableError(ProviderError):
    """Transient outage (timeout / rate limit / 5xx) after retries are exhausted."""

    reason_code = "network_failure"


class ProviderRateLimitedError(ProviderUnavailableError):
    reason_code = "provider_rate_limit"


class ProviderTimeoutError(ProviderUnavailableError):
    reason_code = "model_timeout"


class ProviderInvalidOutputError(ProviderError):
    """Output could not be parsed/validated into the schema after one retry."""

    reason_code = "invalid_json"


class ProviderConfigurationError(RuntimeError):
    """``AI_PROVIDER`` names an adapter that is not registered (US-069).

    Deliberately NOT a ``ProviderError``: a misconfigured provider name is a
    deployment bug to surface loudly (fail fast), not a transient model failure
    to silently absorb via the deterministic fallback."""


@runtime_checkable
class AIProvider(Protocol):
    """The provider adapter contract (US-069). Every adapter:

    - exposes ``name`` (recorded as ``model_provider`` on the run row) and
      ``model_name`` (the tier-resolved model, US-066);
    - implements ``generate() -> dict`` returning output validated against the
      workflow's Pydantic model, or raising a typed ``ProviderError``
      (rate limit / timeout / unavailable / invalid output) so the existing
      fallback and friendly-error behavior is inherited unchanged.

    JSON validation + one repair retry live in shared gateway code
    (``generate_structured``), so an adapter without native structured output
    still returns schema-valid dicts or raises ``ProviderInvalidOutputError``.
    The selection rule (primary when configured, else deterministic fallback;
    fallback also on terminal failure) stays in ``BaseAIWorkflow``; adapters
    never decide fallback."""

    name: str
    model_name: str

    def generate(self) -> dict: ...


class _GenerativeClient(Protocol):
    @property
    def models(self) -> Any: ...


def generate_structured(
    *,
    client: _GenerativeClient,
    model: str,
    prompt: str,
    output_model: type[BaseModel],
    max_attempts: int,
    base_delay_seconds: float,
) -> dict:
    """Call Gemini for JSON matching ``output_model`` and return it as a dict.

    Two independent recovery mechanisms, matching the foundation contract:

    1. Transient provider errors (429/5xx/UNAVAILABLE) are retried with
       exponential backoff up to ``max_attempts`` (same as the extractors).
    2. If a response parses to invalid JSON / fails the schema, the call is
       retried **once** before giving up with ``ProviderInvalidOutputError``.
    """
    from google.genai import types  # imported lazily; only needed when Gemini is used

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=output_model,
    )

    last_invalid: Exception | None = None
    for json_attempt in range(2):
        response = _call_with_transient_retry(
            client=client,
            model=model,
            contents=prompt,
            config=config,
            max_attempts=max_attempts,
            base_delay_seconds=base_delay_seconds,
        )
        try:
            return _parse_response(response, output_model)
        except (ValueError, ValidationError) as exc:
            last_invalid = exc

    raise ProviderInvalidOutputError(
        "Model output could not be validated against the schema."
    ) from last_invalid


def _parse_response(response: Any, output_model: type[BaseModel]) -> dict:
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, output_model):
        return parsed.model_dump(mode="json")
    text = getattr(response, "text", None)
    if not text:
        raise ValueError("Empty model response.")
    return output_model.model_validate_json(text).model_dump(mode="json")


def _call_with_transient_retry(
    *,
    client: _GenerativeClient,
    model: str,
    contents: str,
    config: Any,
    max_attempts: int,
    base_delay_seconds: float,
) -> Any:
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except Exception as exc:
            if not _is_transient(exc):
                raise ProviderInvalidOutputError(str(exc)) from exc
            last_exc = exc
            if attempt < max_attempts:
                time.sleep(base_delay_seconds * (2 ** (attempt - 1)))

    raise _classify_transient(last_exc)


def _is_transient(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in _TRANSIENT_STATUS:
        return True
    text = str(exc)
    return any(marker in text for marker in _TRANSIENT_MARKERS)


def _classify_transient(exc: Exception | None) -> ProviderUnavailableError:
    text = str(exc or "")
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in _RATE_LIMIT_STATUS or any(m in text for m in _RATE_LIMIT_MARKERS):
        return ProviderRateLimitedError("The assistant is rate limited.")
    if any(m in text for m in _TIMEOUT_MARKERS):
        return ProviderTimeoutError("The assistant timed out.")
    return ProviderUnavailableError("The assistant is temporarily unavailable.")


class GeminiProvider:
    """Primary provider: structured Gemini output validated to ``output_model``."""

    name = "gemini"

    def __init__(
        self,
        *,
        prompt: str,
        output_model: type[BaseModel],
        settings: Settings,
        model: str,
        client: _GenerativeClient | None = None,
    ) -> None:
        self._prompt = prompt
        self._output_model = output_model
        self._settings = settings
        # The tier-resolved model (US-066). The caller resolves it via
        # ``model_routing.resolve_model`` so the recorded ``model_name`` reflects
        # the task's tier, not a single global model.
        self._model = model
        self._client = client

    @property
    def model_name(self) -> str:
        return self._model

    def generate(self) -> dict:
        client = self._client
        if client is None:
            try:
                from google import genai
            except ImportError as exc:  # pragma: no cover - environment guard
                raise ProviderUnavailableError("Gemini SDK is not installed.") from exc
            client = genai.Client(api_key=self._settings.gemini_api_key)

        return generate_structured(
            client=client,
            model=self._model,
            prompt=self._prompt,
            output_model=self._output_model,
            max_attempts=self._settings.gemini_max_attempts,
            base_delay_seconds=self._settings.gemini_retry_base_delay_seconds,
        )


class DeterministicFallbackProvider:
    """Fallback provider: runs a workflow-supplied generator, no model call."""

    name = "deterministic"
    model_name = "deterministic-baseline"

    def __init__(self, generator: Callable[[], dict]) -> None:
        self._generator = generator

    def generate(self) -> dict:
        try:
            return self._generator()
        except ProviderError:
            raise
        except Exception as exc:  # generator bug / missing input
            raise ProviderInvalidOutputError(
                "The fallback generator failed to produce output."
            ) from exc


# --- provider registry + factory (US-069) ---------------------------------------
#
# Provider construction is centralized here so no workflow subclass, router, or
# extractor names a concrete adapter. ``AI_PROVIDER`` selects the builder; each
# builder returns a ready ``AIProvider`` or ``None`` when that provider is not
# configured (so the base workflow falls back to deterministic, exactly as the
# Gemini-with-no-key path does today). Registering a new adapter is the entire
# cost of switching providers.

ProviderBuilder = Callable[..., "AIProvider | None"]


def _build_gemini_provider(
    *,
    prompt: str,
    output_model: type[BaseModel],
    settings: Settings,
    model: str,
    client: Any | None = None,
) -> AIProvider | None:
    if not settings.gemini_api_key:
        return None  # not configured → deterministic fallback (unchanged behavior)
    return GeminiProvider(
        prompt=prompt,
        output_model=output_model,
        settings=settings,
        model=model,
        client=client,
    )


_PROVIDER_BUILDERS: dict[str, ProviderBuilder] = {"gemini": _build_gemini_provider}


def register_provider(name: str, builder: ProviderBuilder) -> None:
    """Register an adapter builder under ``name`` (the value of ``AI_PROVIDER``).

    This is the only integration point a new provider needs; nothing in the
    workflow layer changes. Tests use it to prove a second adapter swaps in."""
    _PROVIDER_BUILDERS[name] = builder


def registered_providers() -> list[str]:
    return sorted(_PROVIDER_BUILDERS)


def build_primary_provider(
    *,
    prompt: str,
    output_model: type[BaseModel],
    settings: Settings,
    model: str,
    client: Any | None = None,
) -> AIProvider | None:
    """Build the primary provider selected by ``settings.ai_provider`` (US-069).

    Returns ``None`` when the selected provider is not configured (the base
    workflow then uses the deterministic fallback). Raises
    ``ProviderConfigurationError`` — fail fast — when the name is unknown."""
    name = getattr(settings, "ai_provider", "gemini") or "gemini"
    builder = _PROVIDER_BUILDERS.get(name)
    if builder is None:
        raise ProviderConfigurationError(
            f"AI_PROVIDER='{name}' is not a registered provider. "
            f"Configured providers: {registered_providers()}."
        )
    return builder(
        prompt=prompt,
        output_model=output_model,
        settings=settings,
        model=model,
        client=client,
    )
