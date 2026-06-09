# Overview

## Current Behavior

The match analyzer (US-007) scores a resume against a job using
`apps/web/src/lib/match-analyzer.mjs`: regex keyword matching against a
hardcoded `AI_SKILLS` list, a regex years-of-experience extractor, and five
weighted sub-scores. Output is tagged `analyzer: "deterministic-baseline"`. The
match detail page (`/matches/[matchId]`) shows scores plus strengths,
weaknesses, missing skills, and risks, but the reasoning is templated and does
not change meaningfully with the specific resume/job wording. There is no
apply-recommendation, no evidence-linked strengths, no gap typing, and no
regenerate that creates a new AI run.

## Target Behavior

ApplyWise generates the match analysis with Gemini through the US-027
foundation. It produces the brief's Feature 1 schema: the five sub-scores plus
a weighted `overall_score`, an `apply_recommendation`
(`apply_now | apply_with_improvements | improve_first | not_recommended`), an
`assistant_summary`, `fit_reasoning`, evidence-linked `top_strengths`, classified
`top_gaps` (`true_gap | wording_gap | proof_gap`), `risks`, `next_best_action`,
and `confidence_score`. Each score carries a short AI explanation. Strengths
must cite resume evidence or not appear. The deterministic analyzer becomes the
typed fallback.

The result is saved (extending `matches`), an `ai_workflow_runs` row and an
`activity_feed` event are written, and the user can regenerate to create a new
run. The match detail page is upgraded to render the assistant summary, the
apply recommendation, the per-score explanations, why-you-match, what's-missing,
resume-wording-gaps, risks, and next best action.

## Affected Users

- Software engineers deciding "apply now or improve first" for a specific job —
  this is the first moment ApplyWise should feel like a real assistant.

## Affected Product Docs

- `docs/product/ai-workflows.md` (Match Analyzer section)
- `docs/product/data-model.md` (`matches` gains AI analysis columns)
- `docs/decisions/0012-ai-workflow-standards.md`

## Non-Goals

- Missing-skill deep analysis page (US-029 — this story keeps `top_gaps` inline
  on the analysis; US-029 produces the dedicated `/gaps` breakdown).
- Resume suggestions, draft, roadmap, interview prep (US-031+).
- Changing the scoring weights from the accepted formula in `ai-workflows.md`.
- Job-centric routing.
