# Decision: Application Tracker Status Values

## Status

Accepted.

## Context

The MVP tracker needs persisted application state for saved jobs. Product copy
uses human labels such as `Saved` and `Interviewing`, while forms and database
constraints need stable values that are easy to validate and compare.

## Decision

Store tracker statuses as lowercase machine values:

- `saved`
- `applied`
- `interviewing`
- `offer`
- `rejected`
- `archived`

Render display labels in the web UI from a shared helper. Application rows are
unique per `user_id` and `job_id`, with optional `match_id` context when the
tracker entry is created from a match.

## Consequences

- Server actions and tests validate status values against one shared list.
- Supabase enforces the same workflow with a `check` constraint.
- Product docs distinguish storage values from display labels.
