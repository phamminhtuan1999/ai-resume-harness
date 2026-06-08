# Exec Plan

## Goal

Use existing extracted resume text to generate a reviewable candidate profile
draft and save the reviewed draft as the active profile.

## Scope

In scope:

- Candidate profile extraction schema.
- Protected API endpoint for extraction from an existing resume.
- AI extraction prompt with strict JSON output.
- Confidence metadata and low-confidence field handling.
- Review/edit UI for imported profile data.
- Save reviewed profile into active user profile.
- Tests for no-invention behavior and low-confidence fields.

Out of scope:

- Binary PDF extraction changes.
- Auto-overwriting active profile without review.
- Public profile publishing.
- Resume editor or section-by-section resume rewrite.

## Risk Classification

Risk flags:

- Cross-platform.
- Existing behavior.
- Auth protected data.
- Sensitive resume text.
- AI output validation.
- Database migration likely.
- Weak proof until fixture coverage exists.

## Work Phases

1. Schema: define candidate profile JSON and confidence schema.
2. Data model: decide whether to expand `user_profiles` columns or store
   imported profile JSON plus selected summary fields.
3. Backend API: add profile extraction endpoint using existing resume text.
4. Web UI: add extraction action from resume detail or profile page.
5. Review form: auto-fill fields and allow edit before save.
6. Persistence: save reviewed data as active profile.
7. Verification: fixture tests for complete resumes, missing fields,
   uncertainty, no invention, browser review/save flow, and build.

## Stop Conditions

Pause for human confirmation if:

- The active profile schema needs a large migration.
- The UI needs to expose personal contact fields not previously collected.
- AI provider credentials or cost controls are missing.
- The model returns inferred facts that cannot be traced to resume text.
