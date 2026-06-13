# Job Pre-Score Signal Contract and AI Quick Match

Date: 2026-06-13

## Status

Accepted

## Context

The jobs list (`apps/web/src/app/(app)/jobs`) previously made no AI calls and
showed no fit signal, so the user had no way to triage which job to analyze
next without spending Gemini quota. US-068 adds two things that must not be
confused with each other:

1. A **local pre-score** — a deterministic fit hint on every job row, computed
   from saved data only, zero model calls on page load.
2. An **AI quick match** — an explicit, per-job, fast-tier preview the user
   opts into, persisted through the standard `ai_workflow_runs` path.

Two surfaces now compute the same fit estimate in two languages: the web list
(`job-prescore.mjs`, runs server-side in the Next.js app with no API round
trip) and the API's deterministic fallback for the quick-match workflow
(`quick_match_deterministic.py`). Without a written contract these would drift,
and the AI preview could silently contradict the listing hint next to it.

## Decision

### The pre-score signal contract

The fit estimate is a weighted blend of four signals, each normalized to
`0..100`, computed identically in `job-prescore.mjs` and
`quick_match_deterministic.py`:

| Signal | Weight | Source |
| --- | --- | --- |
| Skill overlap | 0.40 | required skills (extraction/structured) vs profile `technical_background` |
| Title alignment | 0.25 | job title vs profile `target_role` + `current_role` |
| Seniority fit | 0.20 | job `required_experience_years` vs profile `years_of_experience` |
| Location fit | 0.15 | job `work_type`/`location` vs profile location/remote preference |

- **Structured precedence**: `extraction_json` > `structured_json` > the job
  row, mirroring `job-structured-view`.
- **Tiers**: score `>= 70` → `strong`, `>= 45` → `promising`, else `weak`.
- **Insufficient data is never faked**: a job with no required skills, work
  type, seniority, or years yields tier `insufficient` and a `null` score. The
  list shows "not enough info"; the AI fallback collapses `insufficient` to the
  `weak` bucket with low (`0.3`) confidence and an honest headline, so it falls
  below the foundation's `0.5` needs-review line rather than asserting a fit.
- **Neutral, not punitive defaults**: a missing comparison (no target role, no
  candidate location) returns a mid-band neutral value, never a penalty.

The two implementations are kept in lockstep; a parity check pins them to the
same score on a shared fixture. Changing a weight, threshold, or signal is a
change to **this contract** and must update both files plus this record.

### The AI quick match

- A `BaseAIWorkflow` subclass, `workflow_type='quick_match'`,
  `subject_type='job'`, on the **fast** model tier (decision 0021).
- Output is intentionally tiny: a `likelihood` bucket
  (`strong|promising|weak`), a one-line `headline`, and a confidence — never a
  numeric score or a decision label, so it cannot be mistaken for the full
  match analysis (honest-coach register, "The Second Opinion").
- No new table: the preview lives in `ai_workflow_runs.output_snapshot_json`.
- Its `deterministic_fallback` is the pre-score above, so a provider failure
  (rate limit / quota / no key) still returns a usable preview instead of an
  error — the listing always renders.
- Reuse (decision 0022): `reuse_identity` is keyed on the job and profile rows
  (`id` + `updated_at`), so re-requesting an unchanged job serves the persisted
  preview with no model call.

### Capping

The manual, per-job quick match is **never capped** — the user asked for that
one. `AI_QUICK_MATCH_LIMIT` (default 5) bounds only an *automatic* batch
preview, should one be added later; the cap is enforced server-side by
`select_auto_quick_match_jobs`, which returns at most N jobs strongest
pre-score first (`limit = 0` disables auto quick match entirely). No batch
path ships in US-068; the helper is the enforcement point, unit-tested.

### Credits

Quick match does **not** spend credits. It is a zero-commitment preview; quota,
not credits, is the guard (the cap above). Only the full analysis and its
downstream generations spend credits (decision 0020).

## Consequences

- The jobs list gains a fit hint and an opt-in AI preview while page-load
  latency stays independent of AI availability.
- Any future surface that wants the fit estimate reuses this signal contract
  rather than inventing a third scorer.
- The pre-score logic now lives in two languages; the parity test is the guard
  against drift and must be kept green when either file changes.
