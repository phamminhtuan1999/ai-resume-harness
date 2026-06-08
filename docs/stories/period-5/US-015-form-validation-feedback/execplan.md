# Exec Plan

## Goal

Make form validation and feedback predictable across the app while preserving
the current server-action workflow.

## Scope

In scope:

- Shared form field helper for required markers, helper text, and field errors.
- Zod field-error mapping returned by server actions.
- Resume file validation for supported import types and max size.
- Profile, resume, job, match, tracker, roadmap, resume suggestion, resume
  draft, and interview prep forms.
- Unit, lint, type, build, and browser proof.

Out of scope:

- Database migrations.
- API converter implementation changes.
- Auth or MFA behavior.
- New e2e test framework setup.

## Risk Classification

Risk flags:

- Cross-platform.
- Existing behavior.
- Multi-domain.
- Weak proof.

Hard gates:

- No validation change can reject a previously valid persisted row unless the UI
  already constrained that field.
- Resume file validation must match the API-supported import surface.

## Work Phases

1. Discovery: inspect current action schemas and all form components.
2. Contract: add field-error state and validation helpers.
3. Implementation: update server actions and form components.
4. Verification: run tests, lint, typecheck, build, and browser render checks.
5. Harness update: update story proof and record a trace.

## Stop Conditions

Pause for human confirmation if:

- A new database migration is required.
- A form needs to transmit new sensitive user data.
- The resume API and web-supported file types conflict.
