"""The standard AI workflow flow (US-027).

``BaseAIWorkflow.run()`` is the one path every Period 8 AI feature takes:

    authorize -> insert run (queued -> running) -> load input
    -> provider generate (retry once, then deterministic fallback)
    -> validate with Pydantic -> postprocess -> map confidence to status
    -> persist domain result + output snapshot -> update run
    -> write activity event -> emit one redacted log line -> return envelope

Subclasses fill the abstract hooks (``authorize``, ``load_input``,
``build_prompt``, ``output_model``, ``deterministic_fallback``, ``persist``,
``build_activity``) and optionally ``postprocess``. Any unrecoverable failure
still writes the run + an activity event and raises a typed ``AIWorkflowError``
the router turns into a friendly, retryable error envelope. No partial domain
result is written on failure.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.schemas.ai_workflow import (
    AIOutputBase,
    Importance,
    SubjectType,
    WorkflowResponse,
    WorkflowRunEnvelope,
    WorkflowStatus,
    WorkflowType,
)
from app.services.ai.activity_description import (
    ActivityDescriptionHelper,
    fallback_description,
)
from app.services.ai.errors import (
    DEFAULT_MESSAGES,
    AIWorkflowError,
    InvalidJSONError,
    ModelTimeoutError,
    NetworkFailureError,
    ProviderRateLimitError,
    SchemaValidationFailureError,
)
from app.services.ai.logging import WorkflowLogger
from app.services.ai.providers import (
    DeterministicFallbackProvider,
    GeminiProvider,
    ProviderError,
)
from app.settings import Settings

# Below this confidence the result is persisted but flagged for a human look.
LOW_CONFIDENCE_THRESHOLD = 0.5

_PROVIDER_ERROR_TO_API: dict[str, type[AIWorkflowError]] = {
    "invalid_json": InvalidJSONError,
    "provider_rate_limit": ProviderRateLimitError,
    "model_timeout": ModelTimeoutError,
    "network_failure": NetworkFailureError,
}


@dataclass
class ActivitySpec:
    """What the workflow wants written to the activity feed for this run."""

    activity_type: str
    title: str
    importance: Importance = "low"
    related_match_id: str | None = None
    related_job_id: str | None = None
    assistant_description: str | None = None


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class BaseAIWorkflow(ABC):
    workflow_type: WorkflowType
    subject_type: SubjectType
    # Below this confidence the result is persisted but flagged ``needs_review``.
    # Defaults to the foundation constant; a workflow may raise the bar (US-031
    # uses 0.6) without affecting any other workflow.
    low_confidence_threshold: float = LOW_CONFIDENCE_THRESHOLD

    def __init__(
        self,
        *,
        data_client: Any,
        settings: Settings,
        logger: WorkflowLogger | None = None,
        gemini_client: Any | None = None,
    ) -> None:
        self.data = data_client
        self.settings = settings
        self.log = logger or WorkflowLogger()
        # Injected only by tests so the Gemini path runs against a fake client
        # without live calls; production builds a real client lazily.
        self._gemini_client = gemini_client

    # --- abstract hooks ------------------------------------------------------

    @abstractmethod
    def authorize(self, *, subject_id: str, user_profile_id: str) -> Any:
        """Load the subject and assert ownership. Raise ``UnauthorizedError`` if
        the subject is missing or not owned. Runs before any run row is written,
        so an unauthorized call leaves no run/activity behind."""

    @abstractmethod
    def load_input(self, context: Any) -> Any:
        """Gather everything the prompt/fallback need. May raise pre-flight typed
        errors (e.g. ``MissingProfileError``)."""

    @abstractmethod
    def build_prompt(self, data: Any) -> str: ...

    @property
    @abstractmethod
    def output_model(self) -> type[AIOutputBase]: ...

    @abstractmethod
    def deterministic_fallback(self, data: Any) -> dict:
        """Schema-shaped output without a model call (the typed fallback)."""

    @abstractmethod
    def persist(
        self,
        *,
        user_profile_id: str,
        subject_id: str,
        output: AIOutputBase,
        provider_name: str,
        status: WorkflowStatus,
        context: Any,
        data: Any,
    ) -> None:
        """Write the domain result. Only called on the success path."""

    @abstractmethod
    def build_activity(
        self, *, status: WorkflowStatus, output: AIOutputBase | None, context: Any
    ) -> ActivitySpec:
        """Describe the activity-feed event for this run (success or failure)."""

    def postprocess(self, output: AIOutputBase, data: Any) -> AIOutputBase:
        """Optional reconciliation step (e.g. recompute weighted scores)."""
        return output

    # --- the standard flow ---------------------------------------------------

    def run(
        self,
        *,
        subject_id: str,
        user_profile_id: str,
        regenerate: bool = False,
        request_id: str | None = None,
    ) -> dict:
        started = time.monotonic()

        # Ownership is checked before any row is written.
        context = self.authorize(subject_id=subject_id, user_profile_id=user_profile_id)

        run = self.data.insert_workflow_run(
            user_profile_id=user_profile_id,
            workflow_type=self.workflow_type,
            subject_type=self.subject_type,
            subject_id=subject_id,
        )
        run_id = str(run["id"])
        self.data.update_workflow_run(
            run_id=run_id, status="running", started_at=_now_iso()
        )

        try:
            data = self.load_input(context)
            output, provider_name, model_name = self._generate(data)
            output = self.postprocess(output, data)
            status: WorkflowStatus = (
                "needs_review"
                if output.confidence_score < self.low_confidence_threshold
                else "completed"
            )

            self.persist(
                user_profile_id=user_profile_id,
                subject_id=subject_id,
                output=output,
                provider_name=provider_name,
                status=status,
                context=context,
                data=data,
            )

            latency_ms = self._latency_ms(started)
            self.data.update_workflow_run(
                run_id=run_id,
                status=status,
                completed_at=_now_iso(),
                latency_ms=latency_ms,
                confidence_score=output.confidence_score,
                model_provider=provider_name,
                model_name=model_name,
                output_snapshot_json=output.model_dump(mode="json"),
            )
            self._write_activity(
                user_profile_id=user_profile_id,
                run_id=run_id,
                status=status,
                output=output,
                context=context,
            )
            self.log.emit_run(
                request_id=request_id,
                user_id=user_profile_id,
                workflow_type=self.workflow_type,
                subject_type=self.subject_type,
                status=status,
                model_provider=provider_name,
                latency_ms=latency_ms,
            )

            envelope = WorkflowRunEnvelope(
                id=run_id,
                workflow_type=self.workflow_type,
                status=status,
                model_provider=provider_name,  # type: ignore[arg-type]
                model_name=model_name,
                latency_ms=latency_ms,
                confidence_score=output.confidence_score,
                error_message=None,
            )
            return WorkflowResponse(
                workflow_run=envelope, result=output.model_dump(mode="json")
            ).model_dump()

        except AIWorkflowError as exc:
            self._fail_run(
                run_id=run_id,
                user_profile_id=user_profile_id,
                context=context,
                error=exc,
                latency_ms=self._latency_ms(started),
                request_id=request_id,
            )
            raise
        except Exception as exc:  # unexpected bug -> still record + surface safely
            wrapped = AIWorkflowError(DEFAULT_MESSAGES["internal_error"])
            self._fail_run(
                run_id=run_id,
                user_profile_id=user_profile_id,
                context=context,
                error=wrapped,
                latency_ms=self._latency_ms(started),
                request_id=request_id,
            )
            raise wrapped from exc

    # --- internals -----------------------------------------------------------

    def _generate(self, data: Any) -> tuple[AIOutputBase, str, str]:
        prompt = self.build_prompt(data)

        gemini = self._build_gemini_provider(prompt)
        if gemini is not None:
            try:
                raw = gemini.generate()
                return self._validate(raw), "gemini", gemini.model_name
            except ProviderError as exc:
                self.log.emit_fallback(
                    workflow_type=self.workflow_type, reason_code=exc.reason_code
                )

        fallback = DeterministicFallbackProvider(lambda: self.deterministic_fallback(data))
        try:
            raw = fallback.generate()
        except ProviderError as exc:
            raise self._map_provider_error(exc) from exc
        return self._validate(raw), "deterministic", fallback.model_name

    def _build_gemini_provider(self, prompt: str) -> GeminiProvider | None:
        if not self.settings.gemini_api_key:
            return None
        return GeminiProvider(
            prompt=prompt,
            output_model=self.output_model,
            settings=self.settings,
            client=self._gemini_client,
        )

    def _validate(self, raw: dict) -> AIOutputBase:
        try:
            return self.output_model.model_validate(raw)
        except Exception as exc:
            raise SchemaValidationFailureError(
                DEFAULT_MESSAGES["schema_validation_failure"]
            ) from exc

    @staticmethod
    def _map_provider_error(exc: ProviderError) -> AIWorkflowError:
        cls = _PROVIDER_ERROR_TO_API.get(exc.reason_code, NetworkFailureError)
        return cls(DEFAULT_MESSAGES[cls.code])

    @staticmethod
    def _latency_ms(started: float) -> int:
        return max(0, int((time.monotonic() - started) * 1000))

    def _write_activity(
        self,
        *,
        user_profile_id: str,
        run_id: str,
        status: WorkflowStatus,
        output: AIOutputBase | None,
        context: Any,
    ) -> None:
        spec = self.build_activity(status=status, output=output, context=context)

        # US-037: enrich the event with an assistant-style description inline.
        # The workflow's own deterministic spec text is the fallback; the helper
        # never raises, so the activity row is always written.
        description = fallback_description(
            activity_type=spec.activity_type,
            title=spec.title,
            assistant_description=spec.assistant_description,
            importance=spec.importance,
        )
        if status != "failed":
            helper = ActivityDescriptionHelper(
                settings=self.settings, gemini_client=self._gemini_client
            )
            description = helper.generate(
                event_context=self._build_event_context(
                    spec=spec, status=status, output=output, context=context
                ),
                fallback=description,
            )

        self.data.insert_activity(
            user_profile_id=user_profile_id,
            workflow_run_id=run_id,
            activity_type=spec.activity_type,
            title=description.activity_title,
            importance=description.importance,
            related_job_id=spec.related_job_id,
            related_match_id=spec.related_match_id,
            assistant_description=description.assistant_description,
        )

    def _build_event_context(
        self,
        *,
        spec: ActivitySpec,
        status: WorkflowStatus,
        output: AIOutputBase | None,
        context: Any,
    ) -> dict:
        """The Feature 10.2 input shape. Default keeps to safe, non-raw fields
        (no resume/JD text); subclasses may override for richer analysis data."""
        event_context: dict[str, Any] = {
            "activity_event": {
                "activity_type": spec.activity_type,
                "workflow_type": self.workflow_type,
                "status": status,
                "related_job_id": spec.related_job_id,
                "related_match_id": spec.related_match_id,
            },
            "deterministic_summary": {
                "title": spec.title,
                "assistant_description": spec.assistant_description,
                "importance": spec.importance,
            },
        }
        job = context.get("job") if isinstance(context, dict) else None
        if isinstance(job, dict) and job:
            event_context["related_job"] = {
                "title": job.get("title"),
                "company": job.get("company"),
                "location": job.get("location"),
            }
        if output is not None:
            event_context["related_analysis"] = {
                "confidence_score": output.confidence_score
            }
        return event_context

    def _fail_run(
        self,
        *,
        run_id: str,
        user_profile_id: str,
        context: Any,
        error: AIWorkflowError,
        latency_ms: int,
        request_id: str | None,
    ) -> None:
        self.data.update_workflow_run(
            run_id=run_id,
            status="failed",
            completed_at=_now_iso(),
            latency_ms=latency_ms,
            error_code=error.code,
            error_message=error.message,
        )
        self._write_activity(
            user_profile_id=user_profile_id,
            run_id=run_id,
            status="failed",
            output=None,
            context=context,
        )
        self.log.emit_run(
            request_id=request_id,
            user_id=user_profile_id,
            workflow_type=self.workflow_type,
            subject_type=self.subject_type,
            status="failed",
            error_code=error.code,
        )
