# Exec Plan

## Goal

Replace the deterministic match analyzer with a Gemini-generated, evidence-based
match analysis built on the US-027 foundation, persisted to `matches`, surfaced
on the match detail page with apply recommendation, per-score explanations,
evidence-linked strengths, classified gaps, risks, and next best action — with
regenerate and a deterministic fallback.

## Scope

In scope:

- `MatchAnalysisWorkflow(BaseAIWorkflow)`: input = candidate profile, resume
  text, parsed resume (if present), job requirements, raw JD, user preferences;
  prompt = standard preamble + Feature 1 task; schema = the Feature 1 output.
- Pydantic models for the Feature 1.4 schema (scores, recommendation,
  `top_strengths[]` with `resume_evidence`/`job_requirement`/`why_it_matters`,
  `top_gaps[]` with `gap_type`, `risks`, `next_best_action`, per-score
  explanations, `confidence_score`).
- Score post-processing: compute `overall_score` from the accepted weighting and
  reconcile with the model's sub-scores; map score → label.
- Port `match-analyzer.mjs` logic as `DeterministicFallbackProvider` output for
  `match_analysis`, mapped into the new schema (no evidence → no strength).
- Migration `0011_period8_match_analysis_ai.sql`: add columns to `matches`
  (`apply_recommendation`, `assistant_summary`, `fit_reasoning`,
  `top_strengths_json`, `top_gaps_json`, `next_best_action`, `score_explanations_json`,
  `confidence_score`, `analyzer_provider`). Keep existing score/strength columns.
- `SupabaseDataClient.save_match_analysis()`; reuse US-027 run/activity writers.
- `POST /api/matches/{matchId}/analyze` (real prompt now) +
  `POST /api/matches/{matchId}/analyze/regenerate`;
  `GET /api/matches/{matchId}/match-analysis`.
- Web: point the match generate action at the API; upgrade `/matches/[matchId]`
  to the brief's sections; add a Regenerate Analysis action.

Out of scope:

- The dedicated missing-skills `/gaps` page and `suggested_project_task`
  per-gap (US-029).
- Any other workflow.
- New scoring weights or labels.

## Risk Classification

Risk flags:

- External systems — Gemini provider.
- Existing behavior — changes shipped match scoring/output (US-007).
- Public contracts — match analysis API + match detail rendering.
- Data model — additive `matches` columns + migration.
- Audit/security — sensitive resume/JD in prompt; redaction (US-027).
- Weak proof — scoring/evidence behavior needs fixtures.

Hard gates:

- External provider behavior + changing existing behavior → high-risk.
- Provider/observability boundary inherited from
  `docs/decisions/0012-ai-workflow-standards.md` (no new decision unless the
  scoring contract changes).

## Work Phases

1. Pydantic schema + score reconciliation helper + label mapping.
2. Prompt (standard preamble + Feature 1 task + scoring guidance as guidance,
   not hardcoded text).
3. Deterministic fallback mapping from `match-analyzer.mjs`.
4. Migration + `save_match_analysis` persistence.
5. API endpoints (analyze / regenerate / get) on US-027 `BaseAIWorkflow`.
6. Web: wire action to API; upgrade match detail UI; regenerate.
7. Tests (see `validation.md`); update `ai-workflows.md` + `data-model.md`.

## Stop Conditions

Pause for human confirmation if:

- The model's sub-scores cannot be reconciled with the accepted weighting
  without changing the formula.
- Upgrading match detail would break US-029/US-031 assumptions about where gaps
  live.
- A `matches` column rename/migration would be destructive to shipped data.
