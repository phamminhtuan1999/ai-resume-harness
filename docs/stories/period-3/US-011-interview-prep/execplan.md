# Exec Plan

## Goal

Complete the remaining Period 3 MVP output by adding persisted interview prep
suggestions for a saved match.

## Scope

In scope:

- Deterministic MVP interview prep generator.
- `interview_preps` Supabase migration.
- Server action and user-scoped data query.
- `/matches/:id/interview-prep` page and match report CTA.
- Unit, lint, build, Harness, and browser verification where available.

Out of scope:

- LLM provider integration.
- Mock interview chat.
- Resume or roadmap mutation from interview prep.

## Risk Classification

Risk flags:

- Data model.
- Authorization.
- Public product behavior.
- Existing match workflow extension.

Hard gates:

- Data migration.
- Authorization checks in server actions and read queries.

## Work Phases

1. Discovery.
2. Design.
3. Validation planning.
4. Implementation.
5. Verification.
6. Harness update.

## Stop Conditions

Pause for human confirmation if:

- The database migration cannot be represented as additive schema.
- Server action ownership checks cannot reuse current profile scoping.
- Validation requirements need to be weakened.
