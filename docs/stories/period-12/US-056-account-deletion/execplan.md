# Exec Plan — US-056 Account Deletion

## Goal

A truthful, typed-confirmation account erasure that removes all app data and
the Clerk sign-in account in a documented order.

## Scope

In scope:

- `deleteAccountAction` server action (data purge → Clerk user delete).
- `DangerZoneCard` client component with typed `DELETE` confirmation,
  validated by the shared helper in `deletion-view.mjs`.
- Settings page: replace the "Deletion is intentionally unavailable" alert.

Out of scope:

- Resume/job deletion (US-055).
- Data export, grace periods, recovery.

## Risk Classification

Risk flags:

- Auth (the Clerk user itself is deleted; session ends).
- Data model (full cascade purge).
- Audit/security (PII erasure path).
- External systems (Clerk backend API).

Hard gates:

- Auth and data loss — confirmed by the human owner via intake #44 and
  decision 0016.

## Work Phases

1. Discovery — Clerk backend SDK surface, cascade graph (done).
2. Design — decision 0016 + this folder.
3. Validation planning — validation.md (E2E asserts gating only; the
   destructive path is manual — it would destroy the shared test user).
4. Implementation.
5. Verification.
6. Harness update.

## Stop Conditions

Pause for human confirmation if:

- The data purge and Clerk deletion cannot be ordered data-first.
- Any row survives the cascade (schema drift from the documented graph).
- Validation must be weakened beyond the documented E2E exclusion.
