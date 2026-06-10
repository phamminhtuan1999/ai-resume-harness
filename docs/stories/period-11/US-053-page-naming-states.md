# US-053 Page Naming, Empty/Error States & Profile Completeness

## Status

planned

## Lane

normal

## Product Contract

The analysis surface is named for what it is: page title says **Job Analysis**
(route paths unchanged) and a **new breadcrumb** (no breadcrumb primitive
exists today — this story adds one) reads `Jobs → Job Analysis`, doubling as
the page's back-to-jobs affordance. Navigation copy follows, and the page
degrades gracefully: an incomplete profile produces a visible completeness
warning wired into confidence and next actions; analysis failures produce
friendly, recoverable error states with technical detail only under Advanced
Analysis Details.

Covers brief Epics 11 and 12 (user stories 11.1, 12.1, 12.2).

## Relevant Product Docs

- `docs/product/overview.md` (surface naming)
- `docs/product/ui-ux-quality.md` (state and copy rules)
- `docs/stories/period-11/README.md` (restatement #8 — copy-only rename)

## Acceptance Criteria

- Given I open a job match result, then the page title is "Job Analysis" and
  a breadcrumb reads `Jobs → Job Analysis` (when arriving from a job) or the
  matches-list equivalent; since no breadcrumb component exists today, this
  story **creates a reusable breadcrumb primitive** under
  `apps/web/src/components/` (or extends `page-header.tsx`, which currently
  offers only an `eyebrow`) and the breadcrumb serves as the back-to-jobs
  link; the bare title "Matches" no longer appears as the detail-page heading;
  list-page/nav copy is updated consistently (the agreed list label is
  **"Analyzed Jobs"** — plainer than the awkward plural "Job Analyses")
  without changing the `/matches` route paths or breaking existing links.
- Given the matches list renders, then each row shows the latest **decision
  label badge + match %** sourced from the newest `analysis_decisions`
  snapshot (fallback to the legacy score-derived badge for never-recomputed
  matches), replacing the legacy `apply_recommendation` badge — list and
  detail must never speak two vocabularies (decision 0015 §10), and the list
  supports the 10-second triage promise without opening each job.
- Given I save my profile, then the profile editor offers a "Re-check your
  saved analyses?" prompt linking back to affected matches (decision 0015
  §10 — profile edits make decisions stale; the loop needs a trigger at the
  profile end too).
- Given my profile is missing fields that the decision engine flags
  (US-047 `profile_incomplete` reason), then the analysis page shows a
  profile completeness warning, the confidence explanation mentions profile
  incompleteness, and Update Professional Profile appears among recommended
  actions (placement via the US-047/US-049 action mapping).
- Given analysis fails, then the page shows a user-friendly error with a
  recovery path: missing/empty job description → prompt to re-import or
  paste the job description (linking to the existing job edit/import
  surfaces); AI/model issue → offer Refresh Analysis (US-050); technical
  error codes/messages appear only inside Advanced Analysis Details
  (US-051).
- Given no analysis exists yet, then the empty state explains what analysis
  does and offers the generate entry point (aligned with US-048's
  `not_analyzed` handling); empty states use the shared `empty-state`
  component.
- Given any of these states, then copy follows the assistant voice rules: no
  module names, provider names, or workflow vocabulary on the main surface.

## Design Notes

- Commands: none.
- Queries: consumes US-047 package fields (`confidence_reasons`,
  `analysis_state`) and existing error envelopes; the matches list reads each
  row's latest `analysis_decisions` snapshot (one batched query) for the
  badge + match % columns.
- API: none new.
- Tables: none.
- Domain rules: profile-completeness detection is owned by US-047 (server);
  this story renders it. Error-state mapping table (cause → copy → recovery
  action) lives in one web module, not scattered per component.
- UI surfaces: a **new breadcrumb primitive** (added this story) on
  `/matches` list + `/matches/[matchId]`, `page-header.tsx` title wiring, nav
  labels in the app shell (`sidebar-nav.tsx` / `mobile-nav.tsx`), empty/error
  states on the analysis page and its tabs. Route files do not move
  (restatement #8).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-053 --unit 1 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Error-mapping table covers the brief's causes (missing JD, model failure) with correct recovery actions; completeness warning renders from the `profile_incomplete` reason; `no_target_role` renders the set-your-target-role prompt; breadcrumb/title strings; list rows render decision badge + match % from the snapshot fixture with legacy fallback; no technical vocabulary in state copy. |
| Integration | Page render with failure fixture shows friendly state + recovery; incomplete-profile fixture shows warning + profile action; profile save surfaces the re-check prompt. |
| E2E | Breadcrumb visible on detail page; failure and empty states reachable. (Browser E2E remains the suite-wide gap.) |
| Platform | n/a |
| Release | `tsc --noEmit`, `eslint`, `node --test` web suite. |

## Harness Delta

Adds a reusable breadcrumb primitive to the web component library (none exists
today); note it in the trace so later surfaces can reuse it rather than
re-inventing one.

## Evidence

Not started — packet created 2026-06-10.
