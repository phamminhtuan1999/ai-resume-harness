# Version-Keyed AI Run Reuse

Date: 2026-06-13

## Status

Accepted

## Context

Refresh Analysis (decision 0015 §6) re-runs the decision core chain
(match analysis → missing skills → assistant insight) by calling the
orchestrator with `force=True`, which re-spends model quota every time — even
when the resume, job, and profile have not changed since the last run. On
constrained Gemini quota that is the most wasteful repeat cost in the product.
US-067 makes an unchanged re-run free of model calls while keeping Refresh
Analysis a single primary action.

## Decision

A workflow run is **reused** — served from the latest successful run's
persisted output, with no provider call — when all three of these match the
prior run:

1. **input hash** — a redaction-safe SHA-256 over the run's input identity
   (row ids + `updated_at` only, never resume/job/profile text), produced by a
   per-workflow `reuse_identity` hook;
2. **prompt version** — a per-workflow `prompt_version` constant (all existing
   prompts start at `v1`); bumping it invalidates reuse for that workflow type
   only;
3. **resolved model** — the model name the run would use (US-066 tier
   resolution), so a model/tier change re-runs.

Mechanics:

- `ai_workflow_runs` gains nullable `input_hash` and `prompt_version` columns
  (migration 0027). Every new run records both. A null `input_hash` (historical
  rows, or workflows that do not opt into reuse) is never a reusable match.
- The reuse decision lives in `BaseAIWorkflow.run()`, so every workflow inherits
  it. Reuse is only attempted when a model would otherwise run (a key is
  configured); deterministic fallbacks cost no quota to repeat.
- A cache hit records a cheap reused run (preserving the "analyzed at" signal),
  serves the prior `output_snapshot_json`, marks the envelope and log line
  `cached`, and skips both the provider and the domain write.
- `force_refresh` is a new flag, distinct from the orchestrator's existing
  coarse `force` (which only bypasses the "already completed" skip).
  `force_refresh` bypasses reuse end-to-end. The web surfaces it as
  "Analyze again anyway", shown only when the package is **not** stale — a stale
  package already re-runs because its inputs changed, so the input hash differs.
- The core chain (`match_analysis`, `missing_skills`, `assistant_insight`) opts
  in now. When match analysis reuses unchanged, its row is untouched, so the
  downstream gap and insight steps reuse in lockstep.

This changes accepted Refresh Analysis behavior (decision 0015 §6): a refresh on
unchanged inputs is now a no-op reuse rather than a re-run. The user-visible
freshness signals (analyzed-at, staleness) are unchanged, and credits are still
spent at refresh start (unchanged spend model).

## Alternatives Considered

1. Hash raw input text. Rejected: raw resume/JD/profile text must never enter a
   hash, log, or stored column. Row id + `updated_at` is the existing
   redaction-safe identity (`analysis_package._compute_inputs_hash`).
2. Reuse purely on the orchestrator's existing "a successful run exists" skip.
   Rejected: that skip is coarse (any prior success), can't tell whether inputs
   changed, and is bypassed by Refresh's `force=True`. Reuse must be keyed on
   input identity and live in `run()` so it applies to every entry point.
3. Overload the orchestrator's `force` flag for the user's "analyze again".
   Rejected: `force` already means "don't skip a completed step"; conflating it
   with "bypass reuse" makes both behaviors ambiguous. A separate `force_refresh`
   keeps each precise.

## Consequences

Positive:

- Repeated Refresh Analysis on unchanged data performs zero model calls.
- The reuse key is explicit and auditable (durable columns + `cached` log field).
- Opt-in `reuse_identity` means a new workflow never reuses by accident.

Tradeoffs:

- Each participating workflow re-fetches its identity rows (e.g. the candidate
  profile) to compute the hash on every run; cheap relative to a model call.
- A genuine model nondeterminism "re-roll" now requires "Analyze again anyway".

## Follow-Up

- US-068: the job-listing quick match reuses the same fast tier and can adopt
  `reuse_identity` if its result is cached per listing.
