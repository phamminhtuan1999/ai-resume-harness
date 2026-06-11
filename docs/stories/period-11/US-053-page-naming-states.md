# US-053 Page Naming, Empty/Error States & Profile Completeness

## Status

implemented (reusable breadcrumb primitive; "Job Analysis" / "Analyzed Jobs"
copy across nav + list + detail with route paths unchanged; matches-list rows
show the decision label badge + match % from the latest snapshot with legacy
fallback; profile re-check banner on `?recheck=`; profile-completeness warning +
centralized analysis error/health mapping on the main surface; web unit tests +
tsc + eslint green; browser E2E deferred — suite-wide gap)

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

Implemented 2026-06-10.

- **Breadcrumb primitive** (`apps/web/src/components/ui/breadcrumb.tsx`): reusable
  `Breadcrumb` over `Crumb[]` (last crumb = current page, `aria-current`; earlier
  crumbs link). Naming + crumb construction live in
  `apps/web/src/lib/matches-list-view.mjs` (`ANALYZED_JOBS_LABEL`,
  `JOB_ANALYSIS_LABEL`, `jobAnalysisBreadcrumb` → `Analyzed Jobs → Job Analysis`).
  The match layout swaps its US-051 back link for the breadcrumb (first crumb is
  the back-to-jobs link).
- **Naming (copy-only, routes unchanged)**: nav label `Matches → Analyzed Jobs`
  (`app-data.ts`); matches-list title → "Analyzed Jobs"; detail surface named via
  the breadcrumb. `/matches` route paths untouched (restatement #8).
- **List decision badges** (`apps/web/src/app/(app)/matches/page.tsx` +
  `getMatchesList`): one **batched** `analysis_decisions` read (newest-first,
  `.in(match_id, …)`, first-seen-per-match = latest) attaches the latest decision
  to each row. The Verdict column shows the decision label badge (same vocabulary
  as the detail page — decision 0015 §10) with the match % from the snapshot;
  never-recomputed matches fall back to the legacy `apply_recommendation` badge.
  Pure helpers `matchListVerdict` / `matchListScore`.
- **Profile re-check** (`apps/web/src/app/(app)/profile/page.tsx` +
  `profile-recheck-banner.tsx`): a `?recheck={matchId}` deep link (the target of
  US-048's evidence "add it to my profile" / "update your profile" links) renders
  a banner that sends the user back to Refresh the analysis — closing decision
  0015 §10's staleness loop from the profile end.
- **Profile completeness + error/health states** (`analysis-notices.tsx` on the
  overview): `profilePromptFromReasons` gained `showCompletenessWarning`
  (`profile_incomplete`) → a completeness warning + Update-profile action.
  `apps/web/src/lib/analysis-error-view.mjs` (`analysisHealthNotice`) centralizes
  the cause → copy → recovery mapping: a failed module → "Refresh Analysis"; a
  missing/short job description → link to the job edit surface; no module/error
  vocabulary on the main surface (technical detail stays in Advanced).
- **Tests**: `apps/web/tests/matches-list-view.test.mjs` (naming, breadcrumb,
  verdict vocabulary + legacy fallback, score preference) +
  `apps/web/tests/analysis-error-view.test.mjs` (healthy → none, model-failure →
  Refresh, missing-JD → edit-job, precedence, no technical vocabulary) + extended
  `decision-overview.test.mjs` for the completeness flag. **Web: 185 tests pass;
  tsc + eslint clean.**
- **Scope notes**: the matches-list snapshot read uses the service client filtered
  by `user_id` (ownership enforced; RLS-equivalent). Action-phrase CTAs elsewhere
  ("Find matches" / "Review matches") are left as verbs — only the surface name
  (nav, list title, detail breadcrumb) is the "Analyzed Jobs / Job Analysis"
  vocabulary. Page-render integration (failure/incomplete-profile fixtures) and
  browser E2E (breadcrumb visible, states reachable) remain the suite-wide gap.

Durable proof:
`scripts/bin/harness-cli story update --id US-053 --status implemented --unit 1 --integration 0 --e2e 0 --platform 0`.
