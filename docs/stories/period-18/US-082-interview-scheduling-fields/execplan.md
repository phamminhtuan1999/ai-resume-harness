# Exec Plan - US-082 Tracker Interview Scheduling Fields

## Goal

Add persisted interview scheduling metadata to tracker rows without breaking
existing tracker status, learning-target, or job-analysis behavior.

## Scope

In scope:

- Decide field placement for the first slice.
- Add nullable interview scheduling fields.
- Add server validation and update path.
- Render/edit the fields on `/tracker`.
- Update product docs and durable proof.

Out of scope:

- Calendar UI beyond a simple row/date display. Calendar rendering is US-083.
- External calendar integration.
- Notifications/reminders.
- Email parsing.

## Risk Classification

Risk flags:

- Data model.
- Existing behavior.
- Public contracts.
- Weak proof unless migration and ownership tests are added.

Hard gates:

- Data migration.

Lane: high-risk.

## Work Phases

1. Discovery: confirm current `applications` schema, tracker actions, and
   Supabase migration pattern.
2. Design: decide additive `applications` fields vs separate event table. The
   default first-slice recommendation is nullable fields on `applications`.
3. Validation planning: define migration, server validation, ownership, and UI
   proof.
4. Implementation: migration, shared schema/types, action/update path, UI.
5. Verification: unit/integration/browser proof and build/lint checks.
6. Harness update: update product docs, story status, and durable matrix proof.

## Stop Conditions

Pause for human confirmation if:

- Interview scheduling must support multiple rounds per application in the
  first slice.
- External calendar sync or reminders enter scope.
- A separate event table becomes necessary.
- Existing tracker status transitions would need to change.
- Validation would need to be weakened.

