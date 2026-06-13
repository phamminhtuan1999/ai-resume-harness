"""Quick match output schema (US-068, Feature: job-listing AI quick match).

A fast-tier, zero-commitment match-likelihood preview for a single saved job.
Deliberately tiny: a coarse likelihood bucket plus one honest sentence — never a
numeric score or a decision label, so it can never be mistaken for the full
match analysis (honest-coach register, The Second Opinion north star). The
preview payload lives in ``ai_workflow_runs.output_snapshot_json``; there is no
domain table.
"""

from __future__ import annotations

from typing import Literal

from app.schemas.ai_workflow import AIOutputBase

# Weakest -> strongest. Mirrors the local pre-score tiers (minus "insufficient",
# which the deterministic fallback folds into "weak" with low confidence): the
# AI quick match is only ever requested explicitly for one job, so it always
# returns a bucket.
QuickMatchLikelihood = Literal["weak", "promising", "strong"]

QUICK_MATCH_LABEL: dict[QuickMatchLikelihood, str] = {
    "strong": "Likely a strong fit",
    "promising": "Possibly a fit",
    "weak": "Probably a long shot",
}


class QuickMatchOutput(AIOutputBase):
    """The per-job quick-match preview payload."""

    likelihood: QuickMatchLikelihood = "promising"
    # One short, honest sentence on why — no more. Kept brief on purpose so the
    # preview stays a hint, not a report.
    headline: str = ""


def quick_match_label(likelihood: QuickMatchLikelihood) -> str:
    return QUICK_MATCH_LABEL.get(likelihood, QUICK_MATCH_LABEL["promising"])
