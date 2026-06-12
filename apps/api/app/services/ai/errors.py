"""Shared AI-workflow error taxonomy (US-027).

Every failure mode of the standard flow maps to one typed error carrying a
stable ``code``, an HTTP status, a ``retryable`` flag, and a friendly,
user-facing message. The router serializes the error with ``to_envelope()`` into
``{ "error": { "code", "message", "retryable" } }``. These codes are part of the
public contract reused by US-028..US-038.
"""

from __future__ import annotations


class AIWorkflowError(Exception):
    """Base for all typed AI-workflow failures.

    ``message`` is safe to show a user: it must never contain resume/JD text or
    raw provider output.
    """

    code: str = "internal_error"
    http_status: int = 500
    retryable: bool = False

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

    def to_envelope(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
            }
        }


class UnauthorizedError(AIWorkflowError):
    code = "unauthorized"
    http_status = 403
    retryable = False


class MissingProfileError(AIWorkflowError):
    code = "missing_profile"
    http_status = 422
    retryable = False


class MissingJobRequirementsError(AIWorkflowError):
    code = "missing_job_requirements"
    http_status = 422
    retryable = False


class MissingMatchAnalysisError(AIWorkflowError):
    """A downstream step (missing skills, insight, suggestions, roadmap, prep)
    was requested before the match was analyzed. Additive, non-breaking code
    shared by US-029..US-035, all of which build on the US-028 match analysis."""

    code = "missing_match_analysis"
    http_status = 422
    retryable = False


class MatchAnalysisRequiredError(AIWorkflowError):
    """Resume suggestions (US-031) were requested before the match was analyzed.

    Distinct from ``missing_match_analysis`` (US-029/US-030): the US-031 contract
    names this code in its API table and validation proof. Both are additive,
    non-breaking, 422-not-retryable variants of the same dependency guard."""

    code = "match_analysis_required"
    http_status = 422
    retryable = False


class MissingSkillAnalysisRequiredError(AIWorkflowError):
    """The roadmap (US-034) was requested before a missing-skill analysis
    (US-029) exists for the match. Pre-flight: raised before any run row is
    written, per the US-034 contract (no run/roadmap/activity on this guard)."""

    code = "missing_skill_analysis_required"
    http_status = 422
    retryable = False


class MissingDraftCvError(AIWorkflowError):
    """The cover letter (US-063, decision 0019) was requested before a Tailored
    CV with renderable content exists for the match. The letter must reference
    only claims that survived the truth guard, so there is no raw-resume
    fallback — the guided error points the user at the Tailored CV step."""

    code = "missing_draft_cv"
    http_status = 422
    retryable = False


class UnknownStepError(AIWorkflowError):
    """``POST .../ai-workflow/{step}/regenerate`` (US-038) received a ``step``
    that is not a recognised, panel-orchestrated ``workflow_type``."""

    code = "unknown_step"
    http_status = 422
    retryable = False


class InvalidJSONError(AIWorkflowError):
    code = "invalid_json"
    http_status = 502
    retryable = True


class SchemaValidationFailureError(AIWorkflowError):
    code = "schema_validation_failure"
    http_status = 502
    retryable = True


class LowConfidenceError(AIWorkflowError):
    """Reserved code for workflows that choose to fail (rather than flag
    ``needs_review``) when confidence is too low. The base flow flags
    ``needs_review`` instead and does not raise this; it exists so the taxonomy
    is complete and queryable."""

    code = "low_confidence"
    http_status = 422
    retryable = True


class ModelTimeoutError(AIWorkflowError):
    code = "model_timeout"
    http_status = 503
    retryable = True


class ProviderRateLimitError(AIWorkflowError):
    code = "provider_rate_limit"
    http_status = 503
    retryable = True


class NetworkFailureError(AIWorkflowError):
    code = "network_failure"
    http_status = 503
    retryable = True


# Friendly, content-free default messages per code. Workflows may override with a
# more specific (but still content-free) message.
DEFAULT_MESSAGES: dict[str, str] = {
    "unauthorized": "You do not have access to this item.",
    "missing_profile": "Add your candidate profile first, then run the analysis.",
    "missing_job_requirements": (
        "This job has not been parsed yet. Parse the job before analyzing."
    ),
    "missing_match_analysis": (
        "Analyze this match first, then run this step."
    ),
    "match_analysis_required": (
        "Run match analysis before generating resume suggestions."
    ),
    "missing_skill_analysis_required": (
        "Run gap analysis before generating a roadmap."
    ),
    "missing_draft_cv": (
        "Generate the Tailored CV first — the cover letter is written from it."
    ),
    "unknown_step": "That AI workflow step is not recognized.",
    "invalid_json": "The assistant returned an unexpected response. Please try again.",
    "schema_validation_failure": (
        "The assistant returned an unexpected response. Please try again."
    ),
    "low_confidence": "The result needs a closer look before relying on it.",
    "model_timeout": "The assistant is taking too long right now. Please try again.",
    "provider_rate_limit": "The assistant is busy right now. Please try again shortly.",
    "network_failure": "We could not reach the assistant. Please try again.",
    "internal_error": "Something went wrong. Please try again.",
}

# Every code reachable through the taxonomy, for tests and observability.
ERROR_CLASSES: tuple[type[AIWorkflowError], ...] = (
    UnauthorizedError,
    MissingProfileError,
    MissingJobRequirementsError,
    MissingMatchAnalysisError,
    MatchAnalysisRequiredError,
    MissingSkillAnalysisRequiredError,
    UnknownStepError,
    InvalidJSONError,
    SchemaValidationFailureError,
    LowConfidenceError,
    ModelTimeoutError,
    ProviderRateLimitError,
    NetworkFailureError,
)
