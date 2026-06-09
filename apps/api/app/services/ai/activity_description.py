"""Activity description helper (US-037, Feature 10).

Turns a raw workflow event into a short assistant-style title, description, and
importance level. Called inline by ``BaseAIWorkflow`` just before the
``activity_feed`` insert, and by the standalone regenerate endpoint.

The hard rule: ``generate()`` NEVER raises. Any provider/validation failure
returns the caller-supplied fallback (the workflow's own deterministic
``ActivitySpec`` text), so an activity row is never dropped because the
description model misbehaved.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel

from app.services.ai.prompting import with_preamble
from app.services.ai.providers import GeminiProvider

Importance = Literal["low", "medium", "high"]

_ACTIVITY_DESCRIPTION_TASK = """\
Task: Generate a short, assistant-style description of the activity event
described below.
- Write as ApplyWise speaking to the user (e.g. "ApplyWise scored ...").
- activity_title: one plain-text sentence fragment under 90 characters. No
  quotation marks, no JSON fragments, no field names.
- Maximum 2 sentences for assistant_description.
- Explain what happened AND why it matters for the job search.
- Set importance: "high" for events with a direct hiring signal (score >= 75,
  cover letter generated, interview prep completed); "medium" for useful but
  indirect signals; "low" for informational / system events.

Activity event:
"""

# Model titles occasionally leak JSON artifacts (e.g. a stray `","` where a
# dash belongs). Strip quote characters and tidy the punctuation/whitespace
# that removal leaves behind.
_QUOTE_CHARS = "\"“”‘’`"


def _clean_text(text: str | None) -> str | None:
    if not text:
        return text
    cleaned = "".join(ch for ch in text if ch not in _QUOTE_CHARS)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"([,.;:])(?:\s*\1)+", r"\1", cleaned)
    return cleaned.strip()


class ActivityDescriptionOutput(BaseModel):
    activity_title: str
    assistant_description: str
    importance: Importance = "low"


@dataclass
class ActivityDescription:
    """What the caller writes onto the activity row, plus provenance."""

    activity_title: str
    assistant_description: str | None
    importance: str
    provider: str
    model_name: str | None = None


def fallback_description(
    *,
    activity_type: str,
    title: str | None = None,
    assistant_description: str | None = None,
    importance: str = "low",
) -> ActivityDescription:
    """The safe deterministic text (10.1): never empty, never raises."""
    readable = activity_type.split(".")[0].replace("_", " ").strip() or "workflow"
    article = "an" if readable[:1].lower() in "aeiou" else "a"
    return ActivityDescription(
        activity_title=title or f"{readable.capitalize()} completed",
        assistant_description=assistant_description
        or f"ApplyWise completed {article} {readable} workflow.",
        importance=importance if importance in ("low", "medium", "high") else "low",
        provider="deterministic",
    )


class ActivityDescriptionHelper:
    def __init__(
        self,
        *,
        settings: Any,
        gemini_client: Any | None = None,
    ) -> None:
        self._settings = settings
        self._gemini_client = gemini_client

    def generate(
        self, *, event_context: dict[str, Any], fallback: ActivityDescription
    ) -> ActivityDescription:
        """Enrich via Gemini when configured; otherwise (or on ANY failure)
        return ``fallback`` unchanged."""
        if not getattr(self._settings, "gemini_api_key", ""):
            return fallback

        prompt = with_preamble(
            _ACTIVITY_DESCRIPTION_TASK + json.dumps(event_context, default=str)
        )
        provider = GeminiProvider(
            prompt=prompt,
            output_model=ActivityDescriptionOutput,
            settings=self._settings,
            client=self._gemini_client,
        )
        try:
            raw = provider.generate()
            output = ActivityDescriptionOutput.model_validate(raw)
        except Exception:  # noqa: BLE001 - contract: never raise
            return fallback

        return ActivityDescription(
            activity_title=_clean_text(output.activity_title) or fallback.activity_title,
            assistant_description=_clean_text(output.assistant_description)
            or fallback.assistant_description,
            importance=output.importance,
            provider="gemini",
            model_name=provider.model_name,
        )
