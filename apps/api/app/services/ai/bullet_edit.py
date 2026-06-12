"""Tier-2 polish-and-verify pass for one Draft CV bullet (US-060).

A user edit at final check is information-level feedback (decision 0019
Amendment II): one combined pass tone-polishes the text (reword to the CV's
voice, information parity — no claims added or dropped) and re-verifies it
against the same evidence corpus the generator used. Lightweight structured
call (like the extractors) — no ``ai_workflow_runs`` row; this is an edit, not
a generation.

Two server-side floors keep the export guarantee absolute regardless of what
the model answers:

- a numeric token in the user's text that does not occur in the corpus forces
  ``do_not_use_yet`` (the metrics-guard rule, applied to edits);
- a polished text that introduces a number absent from both the user's text
  and the corpus is discarded in favor of the user's own wording.

The deterministic fallback (no key / provider failure) skips polish entirely
and verifies the user's text unchanged — conservative: ``needs_confirmation``
when uncertain, never ``safe_to_use`` by default.
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.draft_cv import BULLET_MAX_CHARS, TruthGuardStatus
from app.services.ai.prompting import with_preamble
from app.services.ai.providers import ProviderError, generate_structured
from app.settings import Settings

_NUMBER_RE = re.compile(r"\$?\d[\d,]*\.?\d*%?")
_MAX_CORPUS_CHARS = 8_000
_MAX_TONE_BULLETS = 12

_GENERIC_EVIDENCE_QUESTION = (
    "Can you point to where your resume or profile supports this claim?"
)


class BulletEditOutput(BaseModel):
    polished_text: str = Field(default="", max_length=BULLET_MAX_CHARS)
    truth_guard_status: TruthGuardStatus = "needs_confirmation"
    evidence_question: str | None = None


def build_edit_corpus(data_client: Any, *, match_id: str, user_profile_id: str) -> str:
    """The same evidence corpus the generator uses (resume + structured profile
    + approved feedback texts), rebuilt at edit time so tier-2 verification and
    generation judge against identical evidence."""
    bundle = (
        data_client.get_match_with_resume_and_job(
            match_id=match_id, user_profile_id=user_profile_id
        )
        or {}
    )
    resume_text = ((bundle.get("resume") or {}).get("raw_text") or "").strip()
    profile_row = data_client.get_candidate_profile(user_profile_id=user_profile_id)
    candidate_profile = (profile_row or {}).get("candidate_profile_json") or {}
    suggestions = data_client.get_resume_suggestions_for_match(
        match_id=match_id, user_profile_id=user_profile_id
    )
    accepted = [
        (row.get("suggested_text") or "").strip()
        for row in suggestions or []
        if isinstance(row, dict)
        and row.get("user_action") == "accepted"
        and (row.get("suggested_text") or "").strip()
    ]
    return "\n".join([resume_text, json.dumps(candidate_profile), *accepted]).lower()


def polish_and_verify(
    *,
    user_text: str,
    cv_json: dict[str, Any],
    corpus: str,
    settings: Settings,
    gemini_client: Any | None = None,
) -> dict[str, Any]:
    """One combined polish+verify pass. Returns
    ``{polished_text, truth_guard_status, evidence_question, provider}``."""
    deterministic = _deterministic_verify(user_text, corpus)

    client = gemini_client
    if client is None and settings.gemini_api_key:
        try:
            from google import genai

            client = genai.Client(api_key=settings.gemini_api_key)
        except ImportError:
            client = None
    if client is None:
        return deterministic

    try:
        raw = generate_structured(
            client=client,
            model=settings.gemini_model,
            prompt=_build_prompt(user_text, cv_json, corpus),
            output_model=BulletEditOutput,
            max_attempts=settings.gemini_max_attempts,
            base_delay_seconds=settings.gemini_retry_base_delay_seconds,
        )
    except ProviderError:
        return deterministic

    polished = (raw.get("polished_text") or "").strip() or user_text
    # Parity floor: a polished text may never introduce a number that is in
    # neither the user's text nor the corpus.
    allowed_numbers = _numbers(user_text) | _numbers(corpus)
    if _numbers(polished) - allowed_numbers:
        polished = user_text

    # Status floor: only the hard metrics rule outranks the model — an
    # invented number is do_not_use_yet no matter what the model answered.
    # (The fallback's never-safe conservatism applies only when no model ran.)
    status = raw.get("truth_guard_status") or "needs_confirmation"
    if deterministic["truth_guard_status"] == "do_not_use_yet":
        status = "do_not_use_yet"

    question = raw.get("evidence_question") or None
    if status != "safe_to_use" and not question:
        question = deterministic["evidence_question"] or _GENERIC_EVIDENCE_QUESTION

    return {
        "polished_text": polished,
        "truth_guard_status": status,
        "evidence_question": question if status != "safe_to_use" else None,
        "provider": "gemini",
    }


def _deterministic_verify(user_text: str, corpus: str) -> dict[str, Any]:
    """No-polish verification: user text unchanged, conservative status."""
    corpus_lower = (corpus or "").lower()
    invented = sorted(_numbers(user_text) - _numbers(corpus_lower))
    if invented:
        return {
            "polished_text": user_text,
            "truth_guard_status": "do_not_use_yet",
            "evidence_question": (
                f"Your edit mentions {', '.join(invented)}, which the resume "
                "evidence does not — where does that figure come from?"
            ),
            "provider": "deterministic",
        }
    return {
        "polished_text": user_text,
        "truth_guard_status": "needs_confirmation",
        "evidence_question": _GENERIC_EVIDENCE_QUESTION,
        "provider": "deterministic",
    }


def _numbers(text: str) -> set[str]:
    return set(_NUMBER_RE.findall(text or ""))


def _build_prompt(user_text: str, cv_json: dict[str, Any], corpus: str) -> str:
    tone = _tone_context(cv_json)
    task = f"""\
Task: The candidate edited one bullet of their tailored CV. Do BOTH steps in
one answer, as JSON only.

1. polished_text — reword the candidate's edit to match the CV's tone and the
   XYZ rule (strong past-tense action verb + what/tech + impact), at most two
   printed lines (<= 240 characters). INFORMATION PARITY IS ABSOLUTE: keep
   exactly the claims, facts, and numbers the candidate wrote — never add a
   claim, drop a fact, or change a number. The candidate owns the information;
   you own only the wording.
2. truth_guard_status — verify the claim against the evidence below:
   safe_to_use (clearly supported), needs_confirmation (plausible but not
   explicit — also return a short evidence_question asking the candidate what
   would prove it), or do_not_use_yet (adds an unsupported claim).

Candidate's edited bullet:
{user_text}

Existing CV bullets (tone reference only):
{tone}

Evidence corpus (resume + profile + approved feedback):
---
{(corpus or "")[:_MAX_CORPUS_CHARS]}
---
"""
    return with_preamble(task)


def _tone_context(cv_json: dict[str, Any]) -> str:
    bullets: list[str] = []
    for section in ("work_experience", "projects"):
        for entry in cv_json.get(section) or []:
            for bullet in entry.get("bullets") or []:
                text = (bullet.get("text") or "").strip()
                if text:
                    bullets.append(f"- {text}")
                if len(bullets) >= _MAX_TONE_BULLETS:
                    return "\n".join(bullets)
    return "\n".join(bullets) or "- (no other bullets yet)"
