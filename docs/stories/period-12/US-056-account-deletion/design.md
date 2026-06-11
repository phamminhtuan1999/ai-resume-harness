# Design — US-056 Account Deletion

## Domain Model

One account = one `user_profiles` row keyed by `clerk_user_id` plus the Clerk
user it maps to. Every workspace table cascades from `user_profiles(id)`
(verified live 2026-06-10): activity_feed, ai_workflow_runs,
analysis_decisions, applications, assistant_insights, cover_letters,
dashboard_ai_summary, draft_cvs, interview_preps, jobs, matches,
missing_skill_analyses, resume_versions, resumes, roadmaps. Deleting the
profile row erases the workspace in one statement.

## Application Flow

1. Settings page renders `DangerZoneCard` with the account email and the
   current record counts (already fetched for the page).
2. The card requires typing `DELETE` (exact, validated by
   `isDeletionConfirmed` in `deletion-view.mjs`); until then the destructive
   button stays disabled.
3. `deleteAccountAction`:
   - Resolves the signed-in Clerk user (no form-supplied ids — the action
     only ever deletes the caller's own account).
   - Re-validates the typed confirmation server-side.
   - Deletes the `user_profiles` row scoped by `clerk_user_id` (data purge,
     the GDPR-critical half).
   - Deletes the Clerk user via `clerkClient().users.deleteUser(...)`,
     which terminates the session.
   - Returns a redirect to `/` (the public landing page).
4. Partial failure order is deliberate: if the Clerk step fails after the
   purge, the action reports the error; retrying re-runs only the Clerk step
   (the empty profile row that the retry's context upsert recreates is
   deleted again, carrying no PII beyond the sign-in identity).

## Interface Contract

- `deleteAccountAction(prev, formData{confirm_text})` → `ActionState`.
- Failures: wrong confirmation text → field error, nothing deleted; Supabase
  error → "Account deletion failed; no data was removed."; Clerk error after
  purge → explicit "data removed, sign-in deletion failed, retry" message.

## Data Model

No DDL. Retention per decision 0016: zero workspace rows and no Clerk user
after success; audit feed rows are purged with the account (no orphaned PII).

## UI / Platform Impact

Settings page: the "Deletion is intentionally unavailable in this MVP" alert
is replaced by the Danger zone card (destructive-styled border, explicit
"permanent, includes your sign-in account" copy, typed confirmation input).
After deletion the visitor lands signed-out on `/`.

## Observability

No surviving audit row by design — the feed is owned by the deleted user.
Server logs (`[ApplyWise action skipped]` warn path) still record failures.

## Alternatives Considered

1. Clerk-first deletion — rejected: a Clerk failure after data purge is
   retriable, but a data failure after Clerk deletion strands orphaned PII
   with no owner able to sign in and retry.
2. Clerk webhook-driven purge (delete Clerk user, let a webhook clean the
   DB) — rejected: no webhook infrastructure in the MVP and the purge must
   be synchronous and observable to the user.
3. Keeping a tombstone audit row — rejected: it would itself be retained
   PII after an erasure request.
