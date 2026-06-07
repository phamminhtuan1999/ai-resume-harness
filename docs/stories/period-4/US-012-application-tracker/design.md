# Design

## Domain Model

An application tracker entry belongs to one user profile and one saved job. It
may optionally reference the match that produced the decision to save the job.

Valid statuses are `saved`, `applied`, `interviewing`, `offer`, `rejected`, and
`archived`.

## Application Flow

- `saveApplicationAction` validates a job id and optional match id, verifies
  both records belong to the signed-in user, inserts the tracker row, and
  redirects to `/tracker`.
- Existing tracker rows are idempotent per user/job and are not downgraded when
  saved again.
- `updateApplicationStatusAction` validates the status and updates only rows
  owned by the signed-in user.
- `/tracker` reads persisted applications with related job and match context.

## Interface Contract

Routes:

- `/jobs/[jobId]`: save the job to tracker.
- `/matches/[matchId]`: save the matched job to tracker with match context.
- `/tracker`: list applications and update status.

User feedback:

- Successful save and update actions show inline alert state and popup.
- Saving redirects to `/tracker`.

## Data Model

Migration `0007_period4_applications.sql` creates `public.applications` with:

- `user_id`, `job_id`, and optional `match_id`.
- status check constraint for the six MVP states.
- unique `(user_id, job_id)` to avoid duplicate tracker rows.
- indexes for user-created, user-status, job, and match lookups.

RLS is enabled. Server actions use the service role only after Clerk identity
and ownership checks.

## UI / Platform Impact

The tracker page changes from placeholder job cards to a persisted workflow
table with status counts, contact details, match link, and inline status form.

## Observability

Failed server actions use the existing skipped-action warning pattern. Harness
trace evidence records migration, tests, and browser proof.

## Alternatives Considered

1. Use jobs directly as tracker rows. Rejected because it cannot represent
   status workflow or distinguish saved job descriptions from applications.
2. Store display labels in the database. Rejected because lowercase machine
   values are easier to validate consistently in forms and SQL constraints.
