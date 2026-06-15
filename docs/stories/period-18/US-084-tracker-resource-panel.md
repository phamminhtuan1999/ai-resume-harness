# US-084 Tracker Resource Panel And Next-Step Routing

## Status

planned

## Lane

normal

## Product Contract

The tracker can guide users to the next useful ApplyWise workflow without
presenting generic third-party link lists as primary product functionality.

The panel routes to product-native actions such as adding/searching jobs,
reviewing jobs that need analysis, and continuing Learning Target roadmaps.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/tracker-template-feature-inventory.md`
- `docs/stories/period-16/README.md`
- `docs/decisions/0015-job-analysis-decision-engine.md`

## Acceptance Criteria

- Given Search AI Jobs is implemented, then the tracker can offer a route to
  that intake path.
- Given Search AI Jobs is not implemented, then the tracker does not show a
  broken primary Search AI Jobs action.
- Given I have saved jobs without analysis, then the panel can route me to
  analyze those jobs.
- Given I have Learning Targets with roadmaps, then the panel can route me to
  continue those roadmaps.
- Given no next-step routes are available, then the panel shows a minimal empty
  state rather than generic course/job-board clutter.
- External job-board links, if any, are secondary and clearly marked as external
  resources, not provider integrations.

## Design Notes

- Commands: none.
- Queries: derive counts for jobs needing analysis, active applications,
  learning targets with roadmaps, and available Period 16 routes.
- API: none.
- Tables: read existing jobs, matches, applications, roadmaps as needed.
- Domain rules: do not imply ApplyWise integrates with a third-party board
  unless a provider story has implemented that integration.
- UI surfaces: `/tracker`.

This story imports the useful idea of a resource section from the Notion
template but converts it into ApplyWise-specific routing.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-084 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Next-step helper covers search available/unavailable, jobs needing analysis, learning targets with/without roadmaps, and no-op empty state. |
| Integration | Tracker loader can derive route counts for the signed-in user without leaking rows. |
| E2E | Browser check verifies visible actions only link to implemented routes and disabled/unavailable states are clear. |
| Platform | Not required. |
| Release | Build/lint/test pass. |

## Harness Delta

None expected.

## Evidence

Add commands, reports, screenshots, or links after validation exists.

