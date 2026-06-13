# US-067 Version-Keyed AI Run Reuse (Skip Model Calls When Inputs Unchanged)

## Status

planned

## Lane

normal (stronger validation — data model + existing behavior flags)

## Product Contract

ApplyWise never burns model quota regenerating a result whose inputs have not
changed. When an AI workflow runs for a subject and the relevant inputs
(resume text, candidate profile, job content), the prompt version, and the
model policy all match the latest completed run, the persisted result is
served as the outcome — no model call. The user sees the existing freshness
signals ("analyzed at", staleness flag) and can always force a true re-run.
Repeated clicks of Refresh Analysis on unchanged data become cheap.

## Relevant Product Docs

- `applywise_ai_model_gateway_quota_optimization_tasks.md` (Epic 4, Epic 8 metadata)
- `docs/decisions/0012-ai-workflow-standards.md`
- `docs/decisions/0015-job-analysis-decision-engine.md` §6 (Refresh Analysis)
- `docs/stories/period-11/US-050-refresh-analysis.md`

## Acceptance Criteria

- `ai_workflow_runs` gains `input_hash` and `prompt_version` columns
  (nullable for historical rows). Every new run records both, plus the model
  policy in effect (existing `model_name` suffices).
- `BaseAIWorkflow.run()` computes the input hash from the workflow's loaded
  input (reusing the redaction-safe approach of
  `analysis_package._compute_inputs_hash`); raw text never enters logs.
- Given the latest completed/needs_review run for (user, workflow_type,
  subject) has the same `input_hash` + `prompt_version` + `model_name`
  resolution, a new run request returns the persisted result and records a
  reused run (or marks the envelope `cached: true`) without calling the
  provider.
- A `force_refresh` option bypasses reuse end-to-end; Refresh Analysis
  (US-050) exposes it only when the package is **not** stale ("Analyze again
  anyway"), keeping one primary action.
- Updating the resume, candidate profile, or job content changes the input
  hash, so the next run genuinely re-calls the model (existing staleness
  semantics from migration 0015 stay intact and consistent).
- Bumping a prompt's version constant invalidates reuse for that workflow
  type only.
- Run envelopes/logging expose cache status (hit/miss) via `WorkflowLogger`
  safe fields, so reuse is observable without payloads.

## Design Notes

- Commands: one Supabase migration `00xx_period15_ai_run_reuse.sql` adding
  `input_hash text`, `prompt_version text` to `public.ai_workflow_runs`.
- Queries: latest-run lookup already exists for the workflow panel; extend to
  filter on hash/version.
- API: run envelope gains a `cached`/`reused` field (additive, no breaking
  shape change).
- Tables: `ai_workflow_runs` (additive columns only).
- Domain rules: reuse decision lives in `BaseAIWorkflow.run()` so all
  workflows inherit it; `RunFullOrchestrator` and `refresh_analysis.py` pass
  through unchanged except for the force flag. Prompt versions are per-
  workflow constants (start at `v1` for all existing prompts).
- UI surfaces: reuse the existing "analyzed at"/staleness affordances
  (US-050/US-051); add the "analyze again anyway" force path. No new page.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-067 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Hash composition (resume/profile/job changes each flip it; irrelevant fields don't); reuse decision matrix (same hash+version+model → reuse; any mismatch → re-run; force → re-run); prompt-version bump invalidates only its workflow type. |
| Integration | Refresh on unchanged inputs performs zero provider calls (fake client assertion) and returns the persisted output; refresh after a resume edit calls the provider; migration applies cleanly with historical null rows readable. |
| E2E | Analyze a match twice without edits: second pass is fast, shows the saved result and timestamp; edit resume → refresh produces a new run. |
| Platform | n/a |
| Release | Historical runs (null hash) are never treated as reusable matches. |

## Harness Delta

Intake #50. The reuse rule (what is in the key: input hash + prompt version +
model policy) should be captured as a decision record at implementation time,
since it changes accepted Refresh Analysis behavior (decision 0015 §6).

## Evidence

Add commands, reports, screenshots, or links after validation exists.
