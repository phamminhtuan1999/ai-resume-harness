# Period 12 — Deletion and Data Controls

## Goal

Replace the settings-page notice "Deletion is intentionally unavailable in
this MVP" with real deletion flows: resume deletion, job deletion, and full
account deletion, each with confirmation proportional to its blast radius,
audit-safe ownership checks, and documented retention rules.

Intake: #44 (new initiative, high-risk lane — data loss, authorization, and
audit/security hard gates). Decision: `docs/decisions/0016-deletion-and-retention.md`.

## Stories

| Story | Title | Shape |
| --- | --- | --- |
| US-055 | Resume and job deletion | High-risk folder `US-055-record-deletion/` |
| US-056 | Account deletion | High-risk folder `US-056-account-deletion/` |

## Scope Summary

- Immediate, permanent hard delete; the existing FK cascade graph is the
  deletion mechanism (no schema migration needed).
- Server actions on the service-role client enforce ownership by scoping
  every delete to `id` + `user_id` and verifying a row was removed.
- Resume/job deletion writes `resume.deleted` / `job.deleted` audit rows to
  `activity_feed` with the record name and cascade counts.
- Account deletion purges `user_profiles` (cascading all app data), then
  deletes the Clerk user, then ends the session. Typed `DELETE` confirmation.
- Out of scope: soft delete/restore, bulk deletion, deletion of individual
  matches or analyses, original-file storage cleanup (no storage objects
  exist).

## Validation Shape

Unit tests for the pure deletion-view helpers; Playwright E2E for resume and
job deletion against seeded rows (UI through DB readback); typed-confirm
gating asserted for account deletion without submitting it (the destructive
account path is verified manually — it would destroy the shared Clerk test
user).
