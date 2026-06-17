"""Deterministic AI relevance pre-filter (US-072, Section 14 of the intake spec).

Zero model calls. Scores a job description against keyword groups from the spec
and returns a pre-score + likely/unlikely verdict so the AI classifier only runs
on plausibly AI-related jobs. Consumed by the cost-safe pipeline in US-074.

The keyword groups here are the canonical spec set. The pre-score is a ranking
signal for picking the top-N jobs to send to the AI, NOT the final AI relevance
score — that comes from the classifier.
"""

from __future__ import annotations

import re
from typing import Any

# --- Keyword groups (Section 14) ------------------------------------------------

# Abbreviations match as whole words (case-insensitive); phrases match as
# case-insensitive substrings. The two-pass approach avoids false positives like
# "CHAIR" matching "AI" or "PALM" matching "ML".

_AI_CORE_PHRASES = [
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "generative ai",
    "genai",
]
_AI_CORE_ABBREVS = ["ai", "ml"]

_LLM_PHRASES = [
    "large language model",
    "langchain",
    "llamaindex",
    "openai",
    "anthropic",
]
_LLM_ABBREVS = ["llm", "claude", "gemini"]

_RAG_PHRASES = [
    "retrieval augmented generation",
    "vector database",
    "semantic search",
    "pgvector",
    "pinecone",
    "weaviate",
    "chroma",
    "faiss",
    "embeddings",
]
_RAG_ABBREVS = ["rag"]

_AGENTS_PHRASES = [
    "ai agent",
    "tool calling",
    "function calling",
    "workflow automation",
    "autonomous workflows",
    "multi-agent",
]
_AGENTS_ABBREVS = ["agents"]

_ENGINEERING_PHRASES = [
    "full-stack",
    "fullstack",
    "system design",
    "production",
    "deployment",
    "observability",
    "evaluation",
]
_ENGINEERING_ABBREVS = ["api", "backend", "platform"]

_EXCLUSION_PHRASES = [
    "ai content reviewer",
    "ai data annotator",
    "ai trainer",
    "content moderation",
    "business analyst",
    "data entry",
    "labeling",
]
_EXCLUSION_ABBREVS = ["sales", "marketing"]


def _word_boundary_hits(text_lower: str, abbrevs: list[str]) -> list[str]:
    hits = []
    for abbrev in abbrevs:
        pattern = r"(?<!\w)" + re.escape(abbrev) + r"(?!\w)"
        if re.search(pattern, text_lower, re.IGNORECASE):
            hits.append(abbrev)
    return hits


def _phrase_hits(text_lower: str, phrases: list[str]) -> list[str]:
    return [p for p in phrases if p in text_lower]


def _group_hits(text_lower: str, phrases: list[str], abbrevs: list[str]) -> list[str]:
    return _phrase_hits(text_lower, phrases) + _word_boundary_hits(text_lower, abbrevs)


def compute_prefilter_score(job: dict[str, Any]) -> dict[str, Any]:
    """Score a job dict against the Section 14 keyword groups.

    Returns::

        {
            "pre_score": int (0-100),
            "likely_ai_related": bool,
            "keyword_hits": list[str],
            "group_hits": {"ai_core": [...], "llm": [...], ...},
        }

    Pure and deterministic — no I/O, no model calls.
    """
    title = str(job.get("title") or "").strip()
    raw = str(job.get("raw_description") or "").strip()
    text = (title + " " + raw).lower()

    ai_core = _group_hits(text, _AI_CORE_PHRASES, _AI_CORE_ABBREVS)
    llm = _group_hits(text, _LLM_PHRASES, _LLM_ABBREVS)
    rag = _group_hits(text, _RAG_PHRASES, _RAG_ABBREVS)
    agents = _group_hits(text, _AGENTS_PHRASES, _AGENTS_ABBREVS)
    engineering = _group_hits(text, _ENGINEERING_PHRASES, _ENGINEERING_ABBREVS)
    exclusion = _group_hits(text, _EXCLUSION_PHRASES, _EXCLUSION_ABBREVS)

    # Title-weighted bonus: AI keywords in the title carry extra signal.
    title_lower = title.lower()
    title_ai_hits = (
        _group_hits(title_lower, _AI_CORE_PHRASES, _AI_CORE_ABBREVS)
        + _group_hits(title_lower, _LLM_PHRASES, _LLM_ABBREVS)
        + _group_hits(title_lower, _RAG_PHRASES, _RAG_ABBREVS)
        + _group_hits(title_lower, _AGENTS_PHRASES, _AGENTS_ABBREVS)
    )

    ai_body_points = (
        min(len(ai_core), 3) * 20
        + min(len(llm), 3) * 15
        + min(len(rag), 3) * 15
        + min(len(agents), 3) * 10
    )
    engineering_bonus = min(len(engineering), 3) * 3
    title_bonus = min(len(title_ai_hits), 2) * 8
    exclusion_penalty = min(len(exclusion), 3) * 20

    raw_score = ai_body_points + engineering_bonus + title_bonus - exclusion_penalty
    pre_score = max(0, min(100, raw_score))

    all_ai_hits = ai_core + llm + rag + agents
    likely_ai_related = len(all_ai_hits) >= 1 and pre_score >= 10

    return {
        "pre_score": pre_score,
        "likely_ai_related": likely_ai_related,
        "keyword_hits": sorted(set(all_ai_hits)),
        "group_hits": {
            "ai_core": ai_core,
            "llm": llm,
            "rag": rag,
            "agents": agents,
            "engineering": engineering,
            "exclusion": exclusion,
        },
    }
