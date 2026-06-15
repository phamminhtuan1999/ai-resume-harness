# US-083 Tracker Interview Calendar View

## Status

planned

## Lane

normal

## Product Contract

After interview scheduling fields exist, signed-in users can view scheduled
interviews in a calendar-oriented tracker view and navigate from an interview
event back to the application/job context.

The calendar is internal to ApplyWise. It does not sync to external calendars
or send reminders.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/data-model.md`
- `docs/product/tracker-template-feature-inventory.md`
- `docs/stories/period-18/US-082-interview-scheduling-fields/`

## Acceptance Criteria

- Given I have tracker rows with interview dates, when I open the calendar
  view, then each scheduled interview appears on the correct date.
- Given I click an interview event, then I can open the linked tracker/job
  context.
- Given an interview row has a stage, then the event displays the stage with
  company/title context.
- Given I have no scheduled interviews, then the calendar shows an empty state.
- Given a Learning Target has an interview date, then the calendar can show it
  without counting it as an active application.
- Given interview scheduling fields are not implemented, this story cannot
  begin.

## Design Notes

- Commands: none.
- Queries: read tracker rows with `interview_date` for the signed-in user.
- API: none unless a dedicated calendar data helper is useful.
- Tables: read `applications.interview_date`, `interview_stage`,
  `interview_notes`, plus linked `jobs`.
- Domain rules: do not derive events from `applied_date`.
- UI surfaces: `/tracker`, either a tab/segmented view or a calendar section.

Keep the first calendar simple: month view or agenda view is acceptable if it
clearly groups by interview date. External calendar integrations are out of
scope.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-083 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Calendar grouping helper covers multiple events per date, empty state, Learning Target rows, and date ordering. |
| Integration | Calendar loader returns only owned scheduled rows and excludes rows with null `interview_date`. |
| E2E | Browser check verifies month/agenda rendering, empty state, and navigation from event to job/tracker context. |
| Platform | Not required beyond build/lint/test. |
| Release | Existing tracker table remains available. |

## Harness Delta

None expected.

## Evidence

Add commands, reports, screenshots, or links after validation exists.

