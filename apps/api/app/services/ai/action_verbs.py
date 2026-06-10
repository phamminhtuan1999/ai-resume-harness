"""Curated strong-action-verb lexicon for the Draft CV XYZ/ATS lint (US-039).

A resume bullet should open with a strong past-tense action verb (the "X" in the
XYZ rule). The lint checks a bullet's first word against this set; a miss
produces a ``weak_action_verb`` quality note (never a silent rewrite). The set is
intentionally broad but finite so the check is deterministic and testable.
"""

from __future__ import annotations

ACTION_VERBS: frozenset[str] = frozenset(
    {
        # build / create
        "architected", "authored", "built", "composed", "constructed", "created",
        "designed", "developed", "engineered", "established", "forged", "formed",
        "formulated", "founded", "generated", "implemented", "initiated",
        "instituted", "introduced", "launched", "pioneered", "produced",
        "programmed", "prototyped", "shipped", "spearheaded",
        # improve / optimize
        "accelerated", "advanced", "boosted", "consolidated", "cut", "decreased",
        "doubled", "tripled", "eliminated", "enhanced", "expanded", "expedited",
        "extended", "hardened", "improved", "increased", "maximized", "minimized",
        "modernized", "optimized", "outpaced", "overhauled", "rearchitected",
        "redesigned", "reduced", "refactored", "refined", "reinforced",
        "remediated", "reorganized", "restructured", "revamped", "scaled",
        "simplified", "slashed", "streamlined", "strengthened", "tuned",
        "upgraded",
        # lead / drive
        "championed", "coordinated", "directed", "drove", "guided", "headed",
        "led", "managed", "mentored", "orchestrated", "organized", "oversaw",
        "owned", "piloted", "steered", "supervised",
        # deliver / execute
        "accomplished", "achieved", "completed", "delivered", "deployed",
        "executed", "finalized", "fulfilled", "released", "rolled",
        # analyze / research
        "analyzed", "assessed", "audited", "benchmarked", "diagnosed",
        "evaluated", "examined", "explored", "identified", "investigated",
        "measured", "modeled", "profiled", "quantified", "researched", "reviewed",
        "surveyed", "tested", "traced", "validated", "verified",
        # build software-specific
        "automated", "configured", "containerized", "debugged", "instrumented",
        "integrated", "migrated", "monitored", "parallelized", "provisioned",
        "secured", "wrote",
        # collaborate / communicate
        "advocated", "aligned", "collaborated", "consulted", "documented",
        "facilitated", "negotiated", "partnered", "presented", "trained",
        # support / maintain
        "administered", "diagnosed", "maintained", "operated", "resolved",
        "supported", "troubleshot",
        # plan / define
        "defined", "drafted", "envisioned", "mapped", "planned", "prioritized",
        "roadmapped", "scoped", "specified", "structured",
    }
)
