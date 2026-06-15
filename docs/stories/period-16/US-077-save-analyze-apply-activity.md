# US-077 Save / Save & Analyze / Open Apply Link + Intake Activity Events

## Status

planned

## Lane

normal

## Product Contract

From any intake mode — search, URL import, or pasted JD — a user can Save a job,
Save & Analyze it in one action, or Open its Apply Link. Saving persists the
job's intake source, AI relevance, and quick-match preview so history stays
explainable. Save & Analyze creates the job (if new) and runs the existing full
Job Analysis Package, routing the user to the analysis page. Every meaningful
intake action (search, import, paste, save, open apply link) is recorded in the
activity feed.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 7, 11, Section 7.1)
- `apps/web/supabase/migrations/0010_period8_ai_workflow_foundation.sql`
  (`activity_feed`), `apps/web/src/lib/activity-feed.mjs`
- `docs/stories/period-16/US-071-job-intake-data-model.md` (persisted fields)

## Acceptance Criteria

- **Save** works from all three intake modes and writes the job with its
  `source` (`discovered_api` for search, `manual_url` for URL, `manual_paste`
  for paste), external identity fields where present, and the AI relevance +
  quick-match results (US-071 columns / snapshot per decision 0025).
- A new `POST /api/jobs/save-external` (or equivalent) persists a normalized
  search result that has no `jobs` row yet, deduping against existing jobs by
  normalized URL / external id.
- **Save & Analyze** saves the job if not already saved and runs the existing
  full analysis (`matches` + `match_analysis`), then routes to the
  `/matches/{matchId}` analysis page (Epic 7.2). On analysis failure the job
  remains saved and analysis is retryable.
- **Open Apply Link** opens the original apply/source URL in a new tab when
  present, and is disabled when absent (Epic 7.3).
- **Activity events** are created for: search performed, URL imported, JD
  pasted, job saved, apply link opened (Epic 11), using `activity_feed` with the
  correct `activity_type`, `related_job_id`, importance, and an honest
  `assistant_description`. They appear on the activity page and group correctly
  via `groupActivities()`.
- Billing: saving and previewing remain free; only the existing paid actions
  (full analysis / tailored CV / etc.) spend credits, consistent with current
  `CREDIT_ACTION_COSTS`. If Save & Analyze triggers a paid analysis, the
  existing spend gate applies unchanged — no new free-credit path is opened.
- The existing deep Job Analysis flow still works after saving/analyzing.

## Design Notes

- Commands: none new (reuses US-071 schema).
- Queries: dedup lookup on save (normalized URL / external id); profile + job
  load for analyze.
- API: `POST /api/jobs/save-external`; reuse existing analyze path
  (`POST /api/jobs/:jobId/analyze` / matches creation). Apply-link open is
  client-side + an activity write.
- Tables: `jobs` (write), `matches` (analyze), `activity_feed` (events).
- Domain rules: source taxonomy per US-071; analyze is explicit (never
  auto-run); save persists AI judgments alongside the job.
- UI surfaces: action buttons on search result cards (US-075) and the URL/paste
  preview (US-076); server actions in `apps/web/src/lib/actions.ts`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-077 --unit 1 --integration 1 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Source mapping per intake mode; dedup key construction; apply-link enabled/disabled logic; activity-spec construction per action. |
| Integration | `save-external` persists normalized result + relevance/quick-match + correct source; dedup prevents duplicates; Save & Analyze creates match and runs analysis; analysis failure leaves job saved; activity rows written with correct type/links; spend gate unchanged. |
| E2E | Save from search/URL/paste lands the job with stored AI data; Save & Analyze routes to `/matches/{id}`; Open Apply Link opens/disables correctly; activity feed shows the intake actions. |
| Platform | n/a |
| Release | Existing analysis E2E still passes; no new uncredited paid path. |

## Harness Delta

Intake #51. New activity types + `save-external` endpoint. Update
`docs/product/data-model.md` (activity types) and the intake UX surface notes.
No new decision beyond 0024/0025/0026.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
