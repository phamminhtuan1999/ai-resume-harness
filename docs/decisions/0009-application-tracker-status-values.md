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
- `prepared` — added by US-038 (migration `0017`): run-full orchestration may
  mark an application prepared once all AI steps complete.
- `applied`
- `interviewing`
- `offer`
- `rejected`
- `archived`
- `learning_target` — added by US-052 (migration `0021`): a weak-but-relevant
  role the user is building skills toward.

Render display labels in the web UI from a shared helper. Application rows are
unique per `user_id` and `job_id`, with optional `match_id` context when the
tracker entry is created from a match.

### Status groups (US-052)

The shared helper also groups statuses for count and pipeline semantics:

- **pipeline** (the **active applications**): `saved`, `prepared`, `applied`,
  `interviewing`, `offer`.
- **closed**: `rejected`, `archived`.
- **learning**: `learning_target` — tracked, but **never** counted as an active
  application and shown in its own tracker segment.

Transitions are unrestricted except for the learning group: any status may
become `learning_target` (always an explicit user choice), and a
`learning_target` may only move to `saved`, `applied`, or `archived` — it is
never silently treated as a live application or set automatically.

## Consequences

- Server actions and tests validate status values against one shared list.
- Supabase enforces the same workflow with a `check` constraint (extended
  additively in `0017` and `0021`).
- Product docs distinguish storage values from display labels.
- Active-application counts (tracker pipeline cards) exclude the learning group.
