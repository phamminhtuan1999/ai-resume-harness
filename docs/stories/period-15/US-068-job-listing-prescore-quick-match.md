# US-068 Job Listing Local Pre-Score and Capped Opt-In AI Quick Match

## Status

planned

## Lane

normal (stronger validation — data model + public contract flags)

## Product Contract

Job listings help the user pick what to analyze next without spending AI
quota. Every job row shows a deterministic local **fit hint** computed from
the saved candidate profile and the job's structured fields — zero AI calls
on page load, ever. For any single job, the user can explicitly request an
**AI quick match** preview (fast model tier) that returns a short
match-likelihood signal without creating a full analysis. Automatic quick
matches are capped by configuration; listings always render even when AI is
unavailable. This is a new feature (today the jobs list makes no AI calls and
shows no fit signal), built deterministic-first per product decision.

## Relevant Product Docs

- `applywise_ai_model_gateway_quota_optimization_tasks.md` (Epic 5)
- `PRODUCT.md` (honest coach register; The Second Opinion north star)
- `docs/stories/period-15/US-066-task-based-model-routing.md` (fast tier)

## Acceptance Criteria

- The jobs list (`apps/web/src/app/(app)/jobs`) shows a local pre-score badge
  per job derived only from saved data (no model call): role/title alignment
  with target roles, skill overlap with the candidate profile, location and
  remote preference fit, seniority mismatch penalty. Jobs missing structured
  data show "not enough info", never a fake score.
- The pre-score is presented as a hint, visually distinct from the real match
  score and decision label (honest-coach register: it must not look like the
  analyzed verdict).
- A per-job "AI quick match" action exists; it runs as a new
  `quick_match` workflow type on the fast model tier, persists through the
  standard run path (`ai_workflow_runs`), and renders a short
  likelihood + one-line reason preview with a link to run the full analysis.
- Quick match is never triggered automatically for every listed job. If batch
  auto-preview is enabled later, `AI_QUICK_MATCH_LIMIT` (default 5) bounds
  how many top pre-scored jobs may receive it; the cap is enforced
  server-side.
- Re-requesting quick match for the same job with unchanged inputs serves the
  persisted preview (US-067 reuse), not a new model call.
- If the AI call fails (rate limit/quota), the listing and pre-scores still
  render; the quick match slot shows the standard friendly retryable message.

## Design Notes

- Commands: migration extending the `ai_workflow_runs.workflow_type` check
  constraint with `quick_match` (subject_type `job`); optional
  `AI_QUICK_MATCH_LIMIT` setting in `apps/api/app/settings.py`.
- Queries: jobs list already loads jobs + profile; pre-score computes
  server-side in the web app (pure `.mjs` scorer like `coverage-view.mjs`,
  US-062 precedent) — no API round trip for the hint.
- API: one new endpoint (e.g. `POST /jobs/{id}/quick-match`) returning the
  standard workflow envelope; reuses auth/ownership checks from existing
  routers.
- Tables: no new table — runs persist in `ai_workflow_runs`
  (`output_snapshot_json` holds the preview payload).
- Domain rules: quick match is a `BaseAIWorkflow` subclass with a small
  Pydantic output (likelihood bucket, headline reason, confidence) and a
  deterministic fallback derived from the local pre-score signals.
- UI surfaces: jobs list rows (badge + action), nothing on the match report.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-068 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Pre-score fixtures: each signal moves the score as specified; missing structured data → "not enough info"; seniority/contract mismatch penalties; scorer is pure and deterministic. Quick match output schema + deterministic fallback. |
| Integration | Quick match endpoint: auth/ownership, run row written with `workflow_type='quick_match'` + fast-tier model name, cap enforcement, friendly error envelope on provider failure. |
| E2E | Jobs list renders pre-score badges with zero AI calls (fake client asserts no invocation); clicking AI quick match on one job shows the preview; provider failure leaves the list usable. |
| Platform | n/a |
| Release | Listing page latency unaffected by AI availability. |

## Harness Delta

Intake #50. New workflow type + new endpoint: update the workflow panel
manifest docs only if quick match is added to a panel (it is not — it lives on
the jobs list). Record a decision if the pre-score signals become a contract
other surfaces reuse.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
