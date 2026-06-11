# Validation — US-055 Resume and Job Deletion

## Proof Strategy

Pure confirm-copy/validation helpers get unit tests; the destructive path is
proven end-to-end with Playwright against seeded live rows, asserting both
the UI outcome and a direct DB readback (rows gone, audit row written,
unrelated rows intact).

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `deletion-view.mjs`: blast-radius sentences for 0/1/N matches and job applications; typed-confirm validator (shared with US-056). |
| Integration | Covered by E2E with DB readback (no separate harness for server actions, per repo convention). |
| E2E | Seed resume+job+match; delete job via UI confirm → job, match, application rows gone, `job.deleted` feed row exists, resume intact; delete resume via UI confirm → resume gone, `resume.deleted` feed row exists; cancel path leaves rows intact. |
| Platform | Not applicable. |
| Performance | Not applicable (single-statement deletes). |
| Logs/Audit | `activity_feed` rows asserted in E2E DB readback. |

## Fixtures

Existing Playwright fixtures: Clerk test user, `seededMatchId` seed/teardown
helpers in `apps/web/e2e/support/db.ts` (service-role client; never the real
account `bd016f67-…`). Deletion spec seeds its own rows so teardown tolerates
already-deleted ids.

## Commands

```text
cd apps/web && npm test
cd apps/web && npx tsc --noEmit && npx eslint src e2e
cd apps/web && npm run test:e2e
```

## Acceptance Evidence

Added after verification (story update + trace record).
