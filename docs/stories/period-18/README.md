# Period 18 - Tracker Command Center

## Goal

Turn the existing `/tracker` page from a status table into a stronger command
center for job-search follow-through: status analytics, actionable row
shortcuts, contact context, interview scheduling, and product-native resource
routing.

Source input:

- `docs/product/tracker-template-feature-inventory.md`
- Notion `Job Finder` template read through the in-app browser on 2026-06-15.

Intake: follow-up to the reviewed Tracker template inventory. The requested
work is story creation only; implementation remains future work.

## Verification Against the Codebase

The Tracker page is not greenfield. The story set below is scoped as deltas over
the current implementation.

| Template feature | Codebase reality | Slice impact |
| --- | --- | --- |
| Status summary | `/tracker` already renders per-status count cards over `TRACKED_STATUSES`; Learning Targets are separated. | US-080 adds chart/rollup visualization, not a rebuild of summary cards. |
| Application database columns | `jobs` and `applications` already store company, title, location, salary, status, notes, and contacts. | No duplicate fields. Stories reuse existing data wherever possible. |
| Contact person | Tracker already surfaces contact name and LinkedIn. | US-081 adds contact notes and clearer action context. |
| CV / cover letter / prep links | ApplyWise has match-specific artifacts and routes. | US-081 adds row-level shortcuts, not global template links. |
| Interview date/calendar | No dedicated interview scheduling field exists. `interview_preps` stores generated prep content, not event scheduling. | US-082 adds scheduling data; US-083 renders calendar UI after that data exists. |
| Job-board and course links | Period 16 covers Search AI Jobs; learning targets and roadmaps already exist. | US-084 adds product-native routing instead of generic external-link clutter. |

## Stories

| Story | Title | Lane | Shape |
| --- | --- | --- | --- |
| US-080 | Tracker status distribution and rollup analytics | normal | Flat story |
| US-081 | Tracker contact notes and application-material shortcuts | normal | Flat story |
| US-082 | Tracker interview scheduling fields | high-risk | High-risk story packet |
| US-083 | Tracker interview calendar view | normal | Flat story, depends on US-082 |
| US-084 | Tracker resource panel and next-step routing | normal | Flat story |

## Suggested Sequence

```text
US-080 (analytics over existing rows)
        |
US-081 (row-level action shortcuts + contact notes)
        |
US-082 (interview scheduling data model)
        |
US-083 (calendar view)

US-084 can land after US-080/US-081, and should wait for Period 16 Search AI
Jobs links if those routes are still pending.
```

## Open Decisions

- **Interview scheduling ownership.** US-082 must decide whether interview
  schedule data belongs directly on `applications` or in a separate
  application-event table. The default recommendation is additive fields on
  `applications` for the first slice.
- **Chart library reuse.** US-080 should reuse existing chart conventions under
  `apps/web/src/components/charts/`; avoid adding a dependency for one chart.
- **Resource panel timing.** US-084 should not link to Search AI Jobs as a
  primary action until Period 16 routes exist.

## Validation Shape

US-080 and US-081 are mostly unit/integration/UI proof: helper aggregation,
loader shape, action visibility, and browser checks on `/tracker`.

US-082 is high-risk because it changes persisted tracker state. It needs a
migration, validation helpers, form/action proof, ownership checks, and an
updated product contract before implementation closes.

US-083 depends on US-082 and proves calendar rendering and navigation from
scheduled interview events. US-084 proves links route only to existing,
allowed, product-native destinations.

