"""Redacting observability for the AI workflow foundation (US-027).

One canonical JSON log line per run, built only from a fixed allowlist of safe
fields. Raw resume/JD text, prompt bodies, and provider payloads must never
reach the log. ``redact()`` is the guard for any place that might otherwise log
a structured payload.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("applywise.ai")

# Keys that may carry sensitive resume/JD content or prompt/provider payloads.
_REDACTED_KEYS = frozenset(
    {
        "raw_text",
        "raw_description",
        "resume_text",
        "job_description",
        "prompt",
        "contents",
        "markdown",
        "output_snapshot_json",
        "candidate_profile_json",
        "structured_json",
        "text",
    }
)
_REDACTED_PLACEHOLDER = "[redacted]"


def redact(value: Any) -> Any:
    """Recursively replace sensitive values so a payload is safe to log.

    Any dict key in the redaction set has its value replaced, regardless of
    nesting depth. Lists are walked element-wise.
    """
    if isinstance(value, dict):
        return {
            key: (_REDACTED_PLACEHOLDER if key in _REDACTED_KEYS else redact(inner))
            for key, inner in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


class WorkflowLogger:
    """Emits exactly one structured line per run from safe fields only."""

    def emit_run(
        self,
        *,
        request_id: str | None,
        user_id: str,
        workflow_type: str,
        subject_type: str,
        status: str,
        model_provider: str | None = None,
        latency_ms: int | None = None,
        error_code: str | None = None,
    ) -> str:
        """Log and return the canonical per-run line.

        Only the fields listed here are ever emitted; there is no path for raw
        content to enter the line.
        """
        line = json.dumps(
            {
                "event": "ai_workflow_run",
                "request_id": request_id,
                "user_id": user_id,
                "workflow_type": workflow_type,
                "subject_type": subject_type,
                "status": status,
                "model_provider": model_provider,
                "latency_ms": latency_ms,
                "error_code": error_code,
            }
        )
        logger.info(line)
        return line

    def emit_fallback(self, *, workflow_type: str, reason_code: str) -> None:
        """Note that the primary provider failed and the fallback was used.

        Records only the reason code (e.g. ``invalid_json``), never the payload.
        """
        logger.info(
            json.dumps(
                {
                    "event": "ai_workflow_fallback",
                    "workflow_type": workflow_type,
                    "reason_code": reason_code,
                }
            )
        )
