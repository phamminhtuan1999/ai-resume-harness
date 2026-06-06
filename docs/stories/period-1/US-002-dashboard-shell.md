# US-002 Dashboard Shell

## Status

in_progress

## Lane

normal

## Product Contract

Authenticated users see a dashboard with onboarding guidance, quick actions,
and resume-aware empty or full states.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/architecture.md`

## Acceptance Criteria

- Given I am logged in, when I visit `/dashboard`, then I see a welcome
  message.
- Given I am logged in, when I visit `/dashboard`, then I see quick actions for
  Add Resume, Analyze Job, and View Tracker.
- Given I have no resume, when I open the dashboard, then I see an empty state
  telling me to add my resume first.
- Given I have at least one resume, when I open the dashboard, then I see my
  primary resume summary.

## Design Notes

- Commands: none beyond navigation.
- Queries: current profile, primary resume summary, basic counts as needed.
- API: dashboard data endpoint or server component query, depending on final
  Next.js implementation.
- Tables: `user_profiles`, `resumes`.
- Domain rules: dashboard data must be scoped to the current user.
- UI surfaces: `/dashboard`, app shell sidebar, primary CTA.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Empty/full state selection helper if extracted. |
| Integration | Dashboard data query returns only current-user records. |
| E2E | Dashboard shows empty state before resume creation and summary after resume creation. |
| Platform | Not required unless deployment routing differs from local routing. |
| Release | Period 1 smoke verifies dashboard first meaningful screen. |

## Harness Delta

No harness change expected.

## Evidence

Scaffold evidence:

- `apps/web/src/app/dashboard/page.tsx`
- Browser DOM verification showed the dashboard heading, quick actions, resume
  empty state, and no console errors.
- Playwright screenshot fallback captured `/private/tmp/applywise-dashboard.png`
  after Browser screenshot capture timed out.
