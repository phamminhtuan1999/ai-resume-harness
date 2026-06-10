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

Add results after verification. Not started — packet created 2026-06-10.
Durable decision refresh required at implementation:
`scripts/bin/harness-cli decision add --id 0009-application-tracker-status-values --title "Application Tracker Status Values" --doc docs/decisions/0009-application-tracker-status-values.md --notes "Refreshed by US-052: adds learning_target."`
