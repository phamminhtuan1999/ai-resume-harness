# Design - US-082 Tracker Interview Scheduling Fields

## Domain Model

An interview schedule belongs to a tracker row because the user schedules
interviews for an application. A row may exist without a match, so the schedule
must not depend on `matches` or `interview_preps`.

Candidate fields for the first slice:

- `interview_date date null`
- `interview_stage text null`
- `interview_notes text null`

Domain rules:

- Empty interview fields are allowed.
- A Learning Target with interview fields is still a Learning Target until the
  user explicitly changes status.
- Interview date does not replace `applied_date`.
- Interview prep content remains generated content under `interview_preps`.

## Application Flow

Commands:

- Update tracker interview details for an owned application row.

Queries:

- Tracker list reads interview fields.
- Job or match detail may read the same fields later, but `/tracker` is the
  first required surface.

Handlers:

- Reuse existing authenticated server-action patterns for tracker updates.
- Validate ownership through the same user/workspace boundary as status
  updates.

## Interface Contract

UI:

- `/tracker` row/detail area can show interview date and stage.
- Editing should be explicit and should preserve current status update
  behavior.
- Error copy should distinguish invalid date from save failure.

Server response:

- Success state after update.
- Validation error for invalid dates or unsupported stage values if stage is
  constrained.
- Ownership denial must not reveal row existence.

## Data Model

Default migration direction:

```text
applications
  interview_date date null
  interview_stage text null
  interview_notes text null
```

Indexes:

- Consider `(user_id, interview_date)` if US-083 calendar queries need it.

Retention:

- Fields cascade with the application row. No separate retention behavior.

Alternative:

- A separate `application_interviews` table supports multiple rounds, but it is
  more complex and should be deferred unless the accepted scope requires
  multiple scheduled events per application.

## UI / Platform Impact

Browser-only. No mobile/native platform split.

## Observability

- Canonical request log through existing app logging.
- Optional activity-feed event for interview schedule updates if tracker status
  updates already emit activity in the implementation branch.

## Alternatives Considered

1. Store scheduling data on `interview_preps`. Rejected because interview prep
   is generated content keyed by match, while scheduling belongs to a tracker
   application and must work without a match.
2. Use `applied_date` as calendar date. Rejected because applying and
   interviewing are different lifecycle events.
3. Add a multi-event table immediately. Deferred until multiple interview
   rounds are required.

