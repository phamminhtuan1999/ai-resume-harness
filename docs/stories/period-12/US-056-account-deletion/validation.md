# Validation — US-056 Account Deletion

## Proof Strategy

The typed-confirmation gate is proven by unit tests (validator) and
Playwright (button stays disabled until `DELETE` is typed — asserted without
submitting). The destructive path itself is excluded from automated E2E
because it would erase the shared Clerk test user; it is verified manually by
the owner against a throwaway account, and the cascade graph it relies on is
the same one US-055's E2E exercises with DB readback.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `isDeletionConfirmed`: exact `DELETE` passes; empty, lowercase, padded, and other strings fail. |
| Integration | Not applicable (two-system destructive flow; see E2E note). |
| E2E | Settings page shows the Danger zone; destructive button disabled initially and with wrong text; enabled after typing `DELETE`; **no submission**. |
| Platform | Not applicable. |
| Performance | Not applicable. |
| Logs/Audit | By design no surviving audit row (decision 0016); failure paths log via the existing action warn path. |

## Fixtures

Playwright Clerk test user (gating assertions only). Manual destructive
verification uses a disposable Clerk account, never the owner's real account
(`user_profiles.id = bd016f67-…`) and never the shared test user.

## Commands

```text
cd apps/web && npm test
cd apps/web && npx tsc --noEmit && npx eslint src e2e
cd apps/web && npm run test:e2e
```

## Acceptance Evidence

Added after verification (story update + trace record).
