# Exec Plan

## Goal

Implement persisted application tracker status workflow for Period 4.

## Scope

In scope:

- Create the Supabase `applications` table.
- Add server actions for saving jobs to the tracker and updating status.
- Replace the tracker placeholder UI with persisted application rows.
- Add save-to-tracker entry points on job and match detail pages.
- Add validation and browser proof.

Out of scope:

- Application analytics.
- Reminder automation.
- External provider sync.

## Risk Classification

Risk flags:

- Authorization.
- Data model.
- Public contracts.
- Existing behavior.
- Weak proof.

Hard gates:

- Authorization.
- Data migration.

## Work Phases

1. Discovery.
2. Design.
3. Validation planning.
4. Implementation.
5. Verification.
6. Harness update.

## Stop Conditions

Pause for human confirmation if:

- Tracker status semantics change beyond the six MVP statuses.
- Existing job or match records require destructive migration.
- Validation requirements need to be weakened.
