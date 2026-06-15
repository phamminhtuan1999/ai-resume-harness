# Overview - US-082 Tracker Interview Scheduling Fields

## Status

planned

## Lane

high-risk

## Current Behavior

The tracker stores application status, linked job, optional match, applied date,
and notes. It has no dedicated interview event date, interview stage, or
interview scheduling notes. `interview_preps` stores generated preparation
content keyed by match; it is not a scheduling table.

## Target Behavior

Users can record upcoming or completed interview scheduling details on a tracker
row:

- Interview date.
- Interview stage.
- Interview notes.

The fields are optional. Existing tracker rows remain valid. Learning Targets
may carry interview fields only if the user explicitly schedules an interview
for that row; the fields do not move the row into the active application count.

## Affected Users

- Signed-in job seekers managing active applications and interviews.

## Affected Product Docs

- `docs/product/data-model.md`
- `docs/product/overview.md`
- `docs/product/tracker-template-feature-inventory.md`
- `docs/decisions/0009-application-tracker-status-values.md`

## Non-Goals

- External calendar sync.
- Reminders or notifications.
- Automatic interview extraction from email or job boards.
- Replacing generated interview prep.
- Changing tracker status values.

