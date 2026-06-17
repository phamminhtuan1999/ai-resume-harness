# US-080 Tracker Status Distribution And Rollup Analytics

## Status

implemented

## Lane

normal

## Product Contract

Signed-in users can scan the tracker and understand application pipeline health
without manually counting rows. `/tracker` keeps the existing per-status cards
and adds a compact distribution/rollup view over existing tracker rows.

Learning Targets remain separate from active applications and are never counted
inside the active pipeline total.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/data-model.md`
- `docs/product/tracker-template-feature-inventory.md`
- `docs/decisions/0009-application-tracker-status-values.md`

## Acceptance Criteria

- Given I have tracker rows across multiple statuses, when I open `/tracker`,
  then I see a status distribution using ApplyWise display labels.
- Given I have active, closed, and learning rows, then active, closed, and
  learning rollups are computed from the shared tracker grouping rules.
- Given I have only Learning Target rows, then active applications remains zero.
- Given I have no tracker rows, then the distribution area shows an empty state
  and does not render misleading chart values.
- Given a new tracker status is added to the shared helper in the future, then
  the distribution uses the helper rather than duplicating status labels.

## Design Notes

- Commands: none.
- Queries: extend the `/tracker` data loader or a pure presenter helper to
  derive distribution buckets from loaded applications.
- API: none.
- Tables: read `applications` with existing job/match joins.
- Domain rules: reuse `apps/web/src/lib/application-tracker.mjs` for status
  display labels and groups.
- UI surfaces: `/tracker`; optionally a compact chart component under
  `apps/web/src/components/charts/`.

Do not replace the existing per-status cards unless implementation proves they
are redundant. The Notion template is only an inspiration for chart shape; the
ApplyWise grouping contract wins.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-080 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Pure aggregation helper covers active, closed, learning, empty, unknown/unsupported status handling, and display-label mapping. |
| Integration | Tracker loader or page data shape returns buckets/counts for seeded rows without changing row ownership behavior. |
| E2E | Browser check on `/tracker` with mixed statuses verifies the distribution, rollups, empty state, and Learning Target exclusion. |
| Platform | Not required. |
| Release | Existing tracker route remains protected and build/lint/test commands pass. |

## Harness Delta

None expected. This story is a product UI/aggregation slice over existing data.

## Evidence

Add commands, reports, screenshots, or links after validation exists.

