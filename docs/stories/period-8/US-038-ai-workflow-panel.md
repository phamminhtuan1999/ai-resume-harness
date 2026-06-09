# US-038 AI Workflow Panel

## Status

implemented — `RunFullOrchestrator` drives the 7 match-scoped workflows
sequentially in dependency order (pre-match steps 1–3 render as derived rows
from profile/job parse state; no workflow_type enum change); failures write
`blocked_by_dependency` run rows for dependents; full completion flips the
tracker row to `prepared` (migration `0017_period8_add_prepared_status.sql`
applied via psql; `prepared` added to the web status vocabulary). New
`run-full` + `{step}/regenerate` endpoints (`unknown_step` 422); `GET
ai-workflow` extended with `output_snapshot_json`/`error_message`/`model_name`.
`AiWorkflowPanel` renders all ten run-driven step rows on the match page with
client-side `deriveStepSummary`, Run Full Workflow, per-step
Regenerate/Retry/View output, and a 3s auto-refresh while steps run. Tests
pass (`tests/test_ai_workflow_panel.py`, `tests/ai-workflow-panel.test.mjs`);
build/lint/tsc clean; smoke → 401. Remaining: browser E2E of run-full with
mixed step outcomes.

## Lane

normal

## Product Contract

The AI Workflow Panel renders on the match detail page and shows all ten AI
workflow steps in order — each with live status, an AI-generated summary,
model provider/name, confidence score, last run time, and per-step actions
(View output, Regenerate, Retry). A **Run Full Workflow** button drives
sequential orchestration of all ten steps. On full completion the application
status can become `prepared`. No new AI model is introduced; this story
orchestrates and surfaces the workflows owned by US-019, US-028–US-030,
US-032–US-035, and the job extractor. Static developer-facing `implemented`
badges are removed.

This is Feature 11 of `applywise_ai_assistant_update_tasks.md`. It reads from
`ai_workflow_runs` established in US-027 and adds `POST run-full` and
`POST {step}/regenerate` endpoints on top of the existing
`GET /api/matches/{matchId}/ai-workflow` route.

## Relevant Product Docs

- `docs/stories/period-8/flows/US-038-ai-workflow-panel-flow.md` (full schemas, mermaid diagrams, step manifest, summary-derivation table)
- `docs/decisions/0012-ai-workflow-standards.md`
- `applywise_ai_assistant_update_tasks.md` §11 (Feature 11)

## Acceptance Criteria

**Panel visibility:**

- Given I open a match detail page I own, then the AI Workflow Panel renders
  with all ten step rows in order below the score grid.
- Given a step has no `ai_workflow_runs` row, then its row shows the
  "Not started" badge and a hardcoded description of what the AI will do.

**Per-step states:**

- Given a step's latest run has `status = running`, then its row shows a
  spinner and the label "Running…".
- Given a step's latest run has `status = completed`, then its row shows a
  green "Completed" badge, an AI-generated summary derived from
  `output_snapshot_json`, model name, confidence score, and last run time.
- Given a step's latest run has `status = needs_review`, then its row shows
  an amber "Needs review" badge, the summary, and a review note.
- Given a step's latest run has `status = failed`, then its row shows a red
  "Failed" badge, `error_message`, and a Retry button.
- Given a step's latest run has `error_code = blocked_by_dependency`, then its
  row shows a grey "Skipped" badge with the text "Skipped — a previous step
  failed."

**Run Full Workflow:**

- Given I have an active candidate profile and a parsed job, when I click
  Run Full Workflow, then all ten steps execute via `POST run-full` in
  dependency order (steps 1–3 first; step 4 gates steps 5–10; step 5 gates
  step 6).
- Given step 4 (AI Match Analysis) fails during run-full, then steps 5–10
  are marked blocked and do not attempt to run; the panel shows a "Failed" row
  for step 4 and "Skipped" rows for steps 5–10.
- Given all ten steps complete with `status = completed` or `needs_review`,
  then the `applications` row for this match has its `status` set to
  `prepared`.
- Given Run Full Workflow is in progress, then the button is disabled while
  any step is `running`; the panel polls `GET ai-workflow` every 3 seconds and
  updates rows as statuses change.

**Regenerate / Retry:**

- Given I click Regenerate on a completed step, then a new `ai_workflow_runs`
  row is created for that step; the previous row is superseded by latest-run
  logic; the row updates in place.
- Given I click Retry on a failed step, then that step reruns via
  `POST {step}/regenerate`; blocked downstream steps remain blocked until
  run-full is re-triggered or each is regenerated manually.

**Authorization:**

- Given I do not own the match, when I call any of the three endpoints, then
  I receive HTTP 403 `unauthorized` and no run is created.
- Given `{step}` in `POST regenerate` is not a recognised `workflow_type`,
  then the endpoint returns HTTP 422 `unknown_step`.

**No static badges:**

- Given the panel renders, then no hard-coded "implemented" text appears; all
  status indicators are driven by `ai_workflow_runs.status`.

## Design Notes

Full schemas, mermaid diagrams (user flow, sequence, dependency graph, data
flow), and the summary-derivation table are in
`docs/stories/period-8/flows/US-038-ai-workflow-panel-flow.md`.

**Component:** `apps/web/src/components/ai-workflow-panel.tsx` (new).
`AIWorkflowPanel` accepts `{ matchId: string }`. On mount calls
`GET /api/matches/{matchId}/ai-workflow`. Polls every 3 s while any run is
`queued` or `running`; stops on quiescence. Renders 10 `StepRow`
sub-components plus a panel-level Run Full Workflow button.

**Assumption (jobId → matchId adaptation):** The brief (§11.5, §11.6) specifies
`{ jobId, resumeId? }` props and `/api/jobs/:jobId/ai-workflow` routes. Per
`docs/decisions/0012-ai-workflow-standards.md §3`, routing stays match-centric.
Props become `{ matchId: string }`; endpoints use `/api/matches/{matchId}/`. The
match record carries both `job_id` and `resume_id`; the panel resolves them
server-side.

**Endpoints (match-centric):**

- `GET /api/matches/{matchId}/ai-workflow` — exists (US-027), extended to
  include `output_snapshot_json` and `error_message` per run object.
- `POST /api/matches/{matchId}/ai-workflow/run-full` — new; optional body
  `{ "force": true }` to re-run already-completed steps.
- `POST /api/matches/{matchId}/ai-workflow/{step}/regenerate` — new; `{step}`
  is the `workflow_type` string.

Router: `apps/api/app/routers/matches.py` (extended from US-027), mounted at
`/api/matches` in `apps/api/app/main.py`.

**Orchestration service:** `apps/api/app/services/ai/run_full_orchestrator.py`
(new). `RunFullOrchestrator` iterates the ordered 10-step manifest, calls each
step's `BaseAIWorkflow` subclass, marks dependents `blocked` (written as a
`failed` run row with `error_code = 'blocked_by_dependency'`) on step failure,
and calls `SupabaseDataClient.flip_application_status_prepared(match_id)` on
full completion.

**Assumption (sequential for MVP):** Steps 1 and 2 are independent but run
sequentially (not in parallel) to keep the orchestrator simple. A future story
can parallelize.

**Assumption (blocked status):** `blocked` is stored as a `failed` run row with
`error_code = 'blocked_by_dependency'`; no enum change to `ai_workflow_runs`.

**Persistence additions** (`apps/api/app/services/supabase_data.py`):
`get_latest_runs_for_match(match_id)` (if not already added by US-027);
`flip_application_status_prepared(match_id)` PATCHing `applications` where
`match_id = :matchId` and `status != 'prepared'`.

**Step summary derivation:** client-side `deriveStepSummary(workflowType,
snapshot)` helper in `apps/web/src/lib/ai-workflow-client.mjs` (extended from
US-027); reads `output_snapshot_json` fields per `workflow_type` — no second
network call. Full derivation table in flow doc §4.

**Assumption (pre-match steps 1–3):** `resume_profile_extraction`, `job_import`,
and `job_requirement_extraction` may not have `ai_workflow_runs` rows. For MVP
the panel treats absent rows as `not_started` and optionally derives a static
`completed` badge from `user_profiles.parse_status` / `jobs.parse_status`. A
migration (`0013_period8_extend_workflow_types.sql`) may be needed to add these
three types to the `workflow_type` enum.

**`applications.status` extension:**

**Assumption:** `prepared` is a new valid value. Migration
`0012_period8_add_prepared_status.sql` updates the `applications.status` check
constraint. Per `docs/decisions/0009-application-tracker-status-values.md`, the
canonical list becomes: `saved`, `applied`, `interviewing`, `offer`, `rejected`,
`archived`, `prepared`.

**Page placement:** `apps/web/src/app/(app)/matches/[matchId]/page.tsx` renders
`<AIWorkflowPanel matchId={matchId} />` below the score grid; existing sub-page
links in the sidebar card are not removed.

**Loading / empty states:** skeleton rows while initial `GET` is in flight;
"No AI steps have run yet. Click Run Full Workflow to prepare your application
materials." when `runs[]` is empty.

**Polling:** 3-second interval while any step is `queued` or `running`; Supabase
Realtime is a future enhancement.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-038 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | `RunFullOrchestrator`: all-complete path calls `flip_application_status_prepared`; step failure writes blocked rows for dependents; ownership denial; `unknown_step` 422. `deriveStepSummary`: all 10 `workflow_type` values against fixture snapshots. Polling logic: starts when running step present, stops when all quiescent. Fake provider — no live model calls. |
| Integration | `POST run-full` runs steps in dependency order; partial result on failure; `applications.status` set to `prepared` on full completion; `GET` response includes `output_snapshot_json` and `error_message`; `POST regenerate` creates new run row and supersedes prior; ownership enforced on all three endpoints. |
| E2E | Open match detail → panel renders 10 rows; click Run Full Workflow → rows update as steps complete; failed step shows Retry; all-complete sets application status badge to Prepared; Regenerate on completed step refreshes the row. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. Static `implemented` badges absent from match detail page. |

## Harness Delta

Reuses US-027 `BaseAIWorkflow`, `ai_workflow_runs` persistence helpers, error
taxonomy, and `activity_feed` writer. No new provider decision (boundary
inherited from `docs/decisions/0012-ai-workflow-standards.md`). Adds:

- New migration `0012_period8_add_prepared_status.sql` (additive enum value on
  `applications.status`).
- Optional new migration `0013_period8_extend_workflow_types.sql` (add pre-match
  `workflow_type` values, or document that steps 1–3 are rendered as static
  rows).
- New service `apps/api/app/services/ai/run_full_orchestrator.py`.
- Two new `SupabaseDataClient` methods.
- Two new routes on the existing `apps/api/app/routers/matches.py` router.
- New component `apps/web/src/components/ai-workflow-panel.tsx`.
- Extended `apps/web/src/lib/ai-workflow-client.mjs` (`runFull`, `regenerateStep`,
  `deriveStepSummary`).

## Evidence

Add pytest output for `RunFullOrchestrator` tests, node test output for
`deriveStepSummary`, and a match-detail-page screenshot showing the panel with
mixed step statuses after validation.
