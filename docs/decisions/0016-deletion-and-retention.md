# 0016 Deletion Semantics and Retention Rules

Date: 2026-06-10

## Status

Accepted

## Context

The MVP shipped with no destructive flows: the settings page carried a notice
that "Deletion is intentionally unavailable in this MVP" because resume, job,
and account deletion need confirmation dialogs, audit-safe ownership checks,
and retention rules. The human owner has now pulled deletion into the current
app version (intake #44, Period 12). Two product policies had to be fixed
before design: what "Delete account" covers, and whether record deletion is
recoverable.

The data model already anticipated deletion: every owned table cascades from
`user_profiles(id)`, `matches` cascade from both `resumes` and `jobs`, all
analysis modules cascade from `matches`, and `activity_feed` keeps its rows
when a referenced job or match disappears (`on delete set null`).
`docs/product/data-model.md` already names the user/match cascade as the
privacy/GDPR deletion path. No resume rows carry storage objects
(`source_storage_path` is unused), so deletion is purely row-level.

## Decision

Confirmed with the human owner on 2026-06-10:

1. **Record deletion is an immediate, permanent hard delete.** Deleting a
   resume or job removes the row and lets the existing FK graph cascade:
   matches and every match-scoped analysis (suggestions, drafts, roadmaps,
   interview preps, insights, decisions) die with it; job deletion also
   removes tracker applications. There is no soft-delete flag and no restore
   window in this version.
2. **Account deletion covers app data plus the Clerk account.** The
   `user_profiles` row is deleted first (cascading every workspace table),
   then the Clerk user is deleted, then the session ends. This is the
   GDPR-style full-erasure interpretation.
3. **Ownership checks are enforced in the mutation, not the dialog.** Server
   actions use the service-role client, which bypasses RLS, so every delete
   statement is scoped by both `id` and the caller's `user_id` and verifies a
   row was actually removed. A non-owned or already-deleted id reports
   "not found" and deletes nothing.
4. **Audit entries survive record deletion but not account deletion.**
   Resume/job deletion writes an `activity_feed` row
   (`resume.deleted` / `job.deleted`) naming the deleted record and the
   cascade counts. Feed rows are owned by the user, so account deletion purges
   them along with everything else — no orphaned PII.
5. **Confirmation is proportional to blast radius.** Record deletion uses an
   inline two-step destructive confirm that states the cascade counts before
   the destructive button appears. Account deletion requires typing `DELETE`
   before the button enables.

## Retention Rules

- Resume and job rows, and everything cascaded from them, are purged at the
  moment of deletion. Nothing recoverable is kept.
- `activity_feed` deletion audit rows are retained for the life of the
  account and purged with it.
- `analysis_decisions` keeps its existing policy (most recent 50 snapshots
  per match) and continues to die with its match or user.
- Account deletion leaves zero rows in any workspace table and no Clerk user.
  If the Clerk deletion step fails after the data purge, the action reports
  the error; retrying only re-runs the Clerk step because the data is already
  gone.

## Alternatives Considered

1. Soft delete with a 30-day restore window — rejected by the owner: every
   read path in the app would need a `deleted_at` filter, a much larger blast
   radius than the MVP needs.
2. App-data-only "reset workspace" account deletion — rejected by the owner
   in favor of true account erasure.
3. Routing deletion through the FastAPI backend — rejected: every other
   CRUD mutation is a Next.js server action on the service client; deletion
   follows the same convention and adds no API surface.

## Consequences

Positive:

- The settings notice can be replaced with real, honest data controls.
- The privacy/GDPR erasure path stops being theoretical.
- No schema migration is needed; the FK graph already encodes the policy.

Tradeoffs:

- Deletion is unrecoverable; the confirm copy must carry that weight.
- Account deletion is a two-system operation (DB + Clerk) with a documented
  partial-failure order: data first, Clerk second.

## Follow-Up

- Account deletion cannot be covered end-to-end by Playwright (it would
  destroy the shared Clerk test user); E2E asserts the typed-confirm gating
  only, and the destructive path is verified manually.
