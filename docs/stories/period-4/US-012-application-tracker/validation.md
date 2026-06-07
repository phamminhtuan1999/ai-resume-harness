# Validation

## Proof Strategy

Prove the tracker workflow at three layers: pure status/validation tests,
Supabase migration/schema verification, and browser save/update workflow.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Status labels, status summaries, save input validation, status input validation. |
| Integration | Supabase `applications` table exists with expected columns and constraints. |
| E2E | Save matched job to tracker, redirect/list view, update status, verify persisted row. |
| Platform | Local Next build. |
| Performance | Indexed user/status tracker reads. |
| Logs/Audit | Existing server action warning pattern for failed writes. |

## Fixtures

- Signed-in local Clerk user.
- Existing seeded match and job records from prior story proof.

## Commands

```text
npm run test:web
npm run lint:web
npm run build:web
git diff --check
```

## Acceptance Evidence

- Migration `apps/web/supabase/migrations/0007_period4_applications.sql` applied through `SUPABASE_DB_URL`.
- Supabase schema verification confirmed 9 `applications` columns, foreign keys,
  unique `(user_id, job_id)`, and the six-status check constraint.
- Signed-in browser saved match `380d45dd-ab5b-4167-b621-0d1e0a644cd4`
  to `/tracker`; the tracker rendered one persisted application row with match
  score `20/100`.
- Signed-in browser updated the row to `Interviewing`; the status summary,
  badge, and select value all reflected `Interviewing`.
- Supabase row `7108d453-6419-4634-9890-b002ded8989e` persisted
  `status = interviewing`, job `78ab163e-d484-49f8-917d-e6c804c42d21`, and
  match `380d45dd-ab5b-4167-b621-0d1e0a644cd4`.
- `npm run test:web` passed 40 tests.
- `npm run lint:web` passed.
- `npm run build:web` passed after approved Turbopack escalation.
- `git diff --check` passed.
