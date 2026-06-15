# US-081 Tracker Contact Notes And Application-Material Shortcuts

## Status

planned

## Lane

normal

## Product Contract

Signed-in users can act from the tracker row without leaving context: review
contact context, open the related job, open job analysis, and jump to generated
application materials when those materials exist or can be generated.

The tracker surfaces existing job contact data and match-specific artifact
routes. It does not create global CV or cover-letter templates.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/data-model.md`
- `docs/product/tracker-template-feature-inventory.md`
- `docs/decisions/0009-application-tracker-status-values.md`
- `docs/decisions/0015-job-analysis-decision-engine.md`

## Acceptance Criteria

- Given a tracker row has `jobs.contact_notes`, when I open `/tracker`, then the
  contact notes are visible or reachable from the row with a label distinct from
  application notes.
- Given a tracker row has a linked job, then I can open the job detail from the
  row.
- Given a tracker row has a linked match, then I can open Job Analysis from the
  row.
- Given a linked match has draft CV, cover letter, interview prep, or roadmap
  routes available, then the tracker shows row-level shortcuts to those routes.
- Given an artifact is not available, then the shortcut is hidden, disabled with
  clear copy, or routes to the correct generation surface according to existing
  readiness rules.
- Given a Learning Target row has a match, then the roadmap shortcut remains
  prominent and does not imply the job is an active application.

## Design Notes

- Commands: none for first slice.
- Queries: ensure tracker loader selects all contact fields and enough
  match/artifact readiness state to decide shortcut availability.
- API: none unless existing server data helpers need route-specific loading.
- Tables: read `jobs`, `applications`, `matches`, and generated artifact
  readiness tables already used by match detail pages.
- Domain rules: material shortcuts must respect Truth Guard and existing
  decision/action placement rules.
- UI surfaces: `/tracker`.

Keep the row compact. Prefer an action group or expandable detail area over
wide columns that make the table hard to scan.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-081 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Shortcut availability helper covers no match, linked match, existing artifacts, missing artifacts, Learning Target roadmap, and contact-notes labels. |
| Integration | Tracker data loader returns owned contact notes and artifact readiness without leaking another user's rows. |
| E2E | Browser check verifies contact notes and shortcuts for rows with and without linked matches. |
| Platform | Not required. |
| Release | Existing tracker status update behavior still passes. |

## Harness Delta

None expected.

## Evidence

Add commands, reports, screenshots, or links after validation exists.

