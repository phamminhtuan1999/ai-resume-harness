# US-036 Dashboard AI Summary

## Status

planned

## Lane

normal

## Product Contract

The dashboard gains an AI-generated card that synthesises signals across all of
a user's jobs — match scores, missing-skill analyses, application statuses, and
recent activity — into a single actionable narrative. It tells the user which
role types fit best, which skills recur as gaps, what health band their search
is in (`strong|moderate|weak`), and what to do next. One summary is persisted
per user in a new `dashboard_ai_summary` table and can be regenerated on demand.
If fewer than 3 jobs have been analyzed the card shows a verbatim data-gate
message and makes no AI call.

This is Feature 9 of `applywise_ai_assistant_update_tasks.md`. It depends on
US-027 (`BaseAIWorkflow`, envelope, run/activity tables, error taxonomy, prompt
preamble, provider/fallback rule) and reads results already persisted by US-028
(match scores) and US-029 (missing-skills analyses). It calls the external
provider through the boundary established in
`docs/decisions/0012-ai-workflow-standards.md` and is therefore a bounded,
normal-lane reuse rather than a new provider decision.

## Relevant Product Docs

- `docs/stories/period-8/flows/US-036-dashboard-ai-summary-flow.md` (source of
  truth — full schemas, Mermaid diagrams, prompt text, fallback rules, dev task
  list)
- `docs/decisions/0012-ai-workflow-standards.md`
- `applywise_ai_assistant_update_tasks.md` §9 (Feature 9, lines 1438–1564)

## Acceptance Criteria

- Given a user has at least 3 analyzed jobs, when the dashboard loads, then the
  AI Job Search Summary card is visible and can be generated.
- Given repeated skill gaps appear across 2 or more jobs' missing-skills
  analyses, when the summary is generated, then `repeated_skill_gaps` in the
  result and in the rendered card mentions those skills by name.
- Given a user has fewer than 3 analyzed jobs, when the dashboard loads, then
  the card displays the verbatim message "ApplyWise needs more analyzed jobs
  before giving a strong pattern-based recommendation. Add or import at least 3
  jobs to unlock a stronger dashboard summary." and no AI call is made.
- Given a user already has a summary, when they click Regenerate Summary, then
  the card re-enters loading state, a new `ai_workflow_runs` row is created, the
  `dashboard_ai_summary` row is overwritten with fresh output, and the updated
  summary is displayed.
- Given `gemini_api_key` is unset, when the summary is generated, then the
  deterministic fallback produces schema-valid output with
  `model_provider = 'deterministic'` and all required fields populated.
- Given the Gemini model returns invalid JSON, when the workflow runs, then it
  retries once; falls back to deterministic on second failure; if all fail the
  run is `failed`, `error_code` is set, and the UI shows a retryable error with
  a Retry button.
- Given a successful or failed run, then no raw candidate profile text or job
  description text appears in emitted server logs (redacting logger from US-027).
- Given generation succeeds, when the dashboard is loaded again in a new
  session, then the cached `dashboard_ai_summary` is returned by `GET` without
  re-calling the model.
- Given low model confidence (`confidence_score < 0.5`), when the run
  completes, then `workflow_run.status = 'needs_review'` and the UI shows a
  "needs review" badge.
- Given the user has no candidate profile, when they attempt generation, then
  the API returns `{ error: { code: "missing_profile", retryable: false } }` and
  no workflow run is created.

## Design Notes

Full schemas, Mermaid diagrams (user flow, sequence, AI processing, ER, data
flow), prompt text, fallback rules, and the concrete dev task list are in
`docs/stories/period-8/flows/US-036-dashboard-ai-summary-flow.md`. Key
structural points:

- **Workflow:** `DashboardSummaryWorkflow(BaseAIWorkflow)`,
  `workflow_type = 'dashboard_summary'`,
  `subject_type = 'dashboard'`, `subject_id = null`.
- **New service:** `apps/api/app/services/ai/dashboard_summary_workflow.py`.
- **New router:** `apps/api/app/routers/dashboard.py` — three endpoints:
  `POST /api/dashboard/ai-summary`, `GET /api/dashboard/ai-summary`,
  `POST /api/dashboard/ai-summary/regenerate`. Mounted in
  `apps/api/app/main.py`.
- **New schema module:** `apps/api/app/schemas/dashboard.py` —
  `DashboardSummaryOutput` Pydantic model + envelope.
- **New table:** `dashboard_ai_summary` (one row per user, UNIQUE on `user_id`,
  FK → `user_profiles(id)` ON DELETE CASCADE). Migration
  `0016_period8_dashboard_ai_summary.sql` (tentative; see migration canonical
  list in `docs/stories/period-8/flows/README.md`).
- **`supabase_data.py` helpers:** `count_analyzed_jobs`, `get_dashboard_summary_input`,
  `upsert_dashboard_summary`, `get_dashboard_ai_summary`.
- **not_enough_data rule:** count of `ai_workflow_runs` rows WHERE
  `workflow_type IN ('match_analysis', 'missing_skills')` AND
  `status = 'completed'` AND `user_id = ?` < 3 → early return, no run row
  created.
- **Deterministic fallback rules:** `repeated_skill_gaps` = skills in ≥ 2
  `missing_skills_across_jobs` entries sorted by frequency; `best_fit_roles` =
  job titles with `match_score ≥ 65%`; `job_search_health` thresholds:
  avg ≥ 70 → `strong`, ≥ 50 → `moderate`, else `weak`;
  `confidence_score = 0.4`.
- **UI component:** new `DashboardAISummaryCard` at
  `apps/web/src/components/dashboard/dashboard-ai-summary-card.tsx`, rendered
  in `apps/web/src/app/(app)/dashboard/page.tsx`. States: `not_enough_data`,
  `loading`, `empty` (GET 204), `success`, `error`. Uses
  `apps/web/src/lib/ai-workflow-client.mjs` (US-027) for envelope handling.
- **Existing settings:** `gemini_api_key`, `gemini_model`,
  `gemini_max_attempts`, `gemini_retry_base_delay_seconds` in
  `apps/api/app/settings.py` reused unchanged.
- **`workflow_type` enum:** defined in US-027 migration
  `0010_period8_ai_workflow_foundation.sql`; if `dashboard_summary` is absent,
  migration `0016` adds it via `ALTER TABLE`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-036 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | not_enough_data early return (no run row, correct envelope); deterministic fallback produces schema-valid output with `provider = 'deterministic'`; Pydantic validation rejects bad `job_search_health` values; `confidence_score < 0.5` → `needs_review`; log redaction verified; all tests use fake provider — no live Gemini calls. |
| Integration | `POST /ai-summary` writes `dashboard_ai_summary` + run row + activity; GET returns cached row without model call; `/regenerate` overwrites existing row and creates new run row; ownership: user A cannot fetch user B's summary; not_enough_data: no run row created; missing_profile → 422 typed error. |
| E2E | Dashboard card renders all six sections on success state; not_enough_data message rendered verbatim; Regenerate transitions to loading then updates card; Retry button visible on retryable error. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. |

## Harness Delta

Reuses US-027 `BaseAIWorkflow`, run/activity writers, envelope, provider
selection, and error taxonomy. No new decision record needed (provider boundary
inherited from `docs/decisions/0012-ai-workflow-standards.md`). Adds: one new
table (`dashboard_ai_summary`), one new router, one new service, one new schema
module, four new `SupabaseDataClient` helpers, one new UI component.
`workflow_type = 'dashboard_summary'` may require an `ALTER TABLE` in the
migration if not already listed in `0010_period8_ai_workflow_foundation.sql`.

## Evidence

Add pytest/node output and a dashboard screenshot after validation.
