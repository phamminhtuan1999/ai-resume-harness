# Validation — US-052 Learning Target Tracker Flow

## Proof Strategy

Prove the status value end to end: constraint accepts it, shared validation
accepts it, counts exclude it, transitions are guarded, and the UI surfaces
it — with the migration applied to the live Supabase DB per the established
flow (`psql` + `SUPABASE_DB_URL` from `apps/api/.env.local`).

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-052 --unit 1 --integration 1 --e2e 0 --platform 0`.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Shared status helper includes `learning_target` with display label/badge/group; transition matrix (allowed and rejected moves); active-application count function excludes the learning group; save-as-learning-target requires confirm when a pipeline row exists. |
| Integration | Upsert creates row with `learning_target`; existing pipeline row is not silently re-statused; tracker list filter returns only learning targets; dashboard summary excludes them from active counts; invalid status rejected by both server validation and the DB CHECK constraint; roadmap affordance present only with `match_id`. |
| E2E | From a learning_target-decision match: Save as Learning Target → tracker shows it under the Learning Targets segment → dashboard active count unchanged → Generate Roadmap reachable. (Browser E2E remains the suite-wide gap.) |
| Platform | n/a |
| Performance | n/a (status filter on existing indexes at MVP scale). |
| Logs/Audit | Activity entry on save; status transitions visible in tracker history/notes per existing behavior. |

## Fixtures

- User with: job A (no tracker row), job B (tracker row `applied`), job C
  (tracker row `learning_target` with match + roadmap), for save/confirm/
  count/filter cases.

## Commands

```text
cd apps/api && .venv/bin/python -m pytest tests -q && .venv/bin/ruff check
cd apps/web && npx tsc --noEmit && npx eslint . && node --test
psql "$SUPABASE_DB_URL" -f apps/web/supabase/migrations/<NNNN>_period11_learning_target_status.sql
psql "$SUPABASE_DB_URL" -c "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'applications'::regclass;"
```

## Acceptance Evidence

Implemented 2026-06-10.

- **Migration** `apps/web/supabase/migrations/0021_period11_learning_target_status.sql`
  (additive drop+add of the `applications_status_check` CHECK) **applied to the
  live Supabase DB** via `psql "$SUPABASE_DB_URL"`. Verified:
  `pg_get_constraintdef` now lists `learning_target` alongside the existing
  seven values.
- **Shared status helper** (`apps/web/src/lib/application-tracker.mjs`):
  `learning_target` added to `APPLICATION_STATUSES` + label "Learning Target";
  `APPLICATION_STATUS_GROUPS` (pipeline / closed / learning), `TRACKED_STATUSES`
  (excludes learning), `ACTIVE_APPLICATION_STATUSES` + `countActiveApplications`
  (learning excluded), `partitionApplications`, `applicationStatusGroup`,
  `canChangeApplicationStatus` (transition guard), `learningTargetSavePlan`
  (insert / update / needs_confirm). The Zod enum
  (`action-validation.mjs`) auto-extends since it reads this list.
- **Save action** (`apps/web/src/lib/actions.ts` `saveLearningTargetAction`):
  upserts the unique `(user_id, job_id)` row to `learning_target`; a row already
  in the pipeline returns `requiresConfirm` (no silent demotion); the client
  (`learning-target-action.tsx`) re-submits with `confirm=true`. The saved
  `learning_target` status **asserts directional relevance** — the decision
  adapter's `user_asserted_relevance` signal is now live.
  `updateApplicationStatusAction` gained the transition guard.
- **Tracker UI** (`apps/web/src/app/(app)/tracker/page.tsx`): pipeline summary
  cards iterate `TRACKED_STATUSES` (learning excluded); a dedicated **Learning
  Targets** segment lists them with a self-defining description, a match link,
  and a **4-Week Roadmap** link (when `match_id` present). `NextActionsPanel`
  routes `save_learning_target` to the confirm-flow component.
- **Decision engine** (no code change needed — the signal was pre-wired):
  `apps/api/tests/test_learning_target_relevance.py` proves a `learning_target`
  application flips a weak unrelated role from `not_recommended` to
  `learning_target`, and other statuses don't assert relevance.
- **Tests**: `apps/web/tests/application-tracker.test.mjs` (status list, groups,
  active-count exclusion, partition, transition guard, save-plan) +
  `apps/api/tests/test_learning_target_relevance.py`. **API 391 passed + ruff
  clean; web 177 tests, tsc + eslint clean.**
- **Scope notes / deviations**: the **dashboard has no application-status
  aggregate** (it counts Profiles/Resumes/Jobs), so count-exclusion is realized
  on the tracker page (open question #3 — no separate dashboard tile added).
  Tracker status changes don't write activity-feed rows today (the feed is
  AI-workflow-driven); the learning-target save follows that existing behavior
  rather than introducing new activity plumbing. Browser E2E (save → segment →
  active count unchanged → roadmap reachable) remains the suite-wide gap.

Durable decision refreshed at implementation:
`scripts/bin/harness-cli decision add --id 0009-application-tracker-status-values --title "Application Tracker Status Values" --doc docs/decisions/0009-application-tracker-status-values.md --notes "Refreshed by US-052: adds learning_target (and records prepared); defines pipeline/closed/learning groups + transition guard."`
