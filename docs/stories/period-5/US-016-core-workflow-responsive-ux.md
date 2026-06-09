# US-016 Core Workflow Responsive UX Rework

## Status

implemented (delivered via Period 7)

## Lane

high-risk

## Product Contract

The authenticated ApplyWise workspace must be comfortable on desktop and mobile.
Users must be able to move between dashboard, resumes, jobs, matches, tracker,
pricing, and settings without losing the main workflow context.

## Relevant Product Docs

- `docs/product/ui-ux-quality.md`
- `docs/product/overview.md`

## Acceptance Criteria

- Mobile navigation exposes the same core destinations as the desktop sidebar.
- Dashboard, list pages, detail pages, and generated-output pages have clear
  page hierarchy and direct next actions.
- Empty, loading, error, and success states are intentional on each major
  workflow surface.
- Tables and dense result panels collapse or scroll predictably on small
  screens.
- Long job URLs, generated text, resume snippets, and contact details do not
  break layout.
- Browser verification covers at least one complete resume-to-job-to-match flow
  on desktop and mobile widths.

## Design Notes

- Commands: update app shell and page-level layout components.
- Queries: none expected.
- API: none expected unless loading/error behavior reveals missing data helpers.
- Tables: none expected.
- Domain rules: do not change match scoring or generated AI content.
- UI surfaces: `apps/web/src/components/app-shell.tsx` and protected app pages.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-016 --unit 1 --integration 0 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tests for any shared navigation or state helper. |
| Integration | Not required unless data loading behavior changes. |
| E2E | Browser walkthrough across dashboard, list, detail, and generation surfaces. |
| Platform | Desktop and mobile screenshots with console inspection. |
| Release | `npm run test:web`, `npm run lint:web`, and `npm run build:web`. |

## Harness Delta

Tracks responsive workflow polish separately from visual styling because
navigation and dense workflow layout have different risk than color/type cleanup.

## Evidence

This story's acceptance criteria were delivered by the Period 7 design overhaul
(decision `docs/decisions/0011-design-system-overhaul.md`) rather than as a
standalone Period 5 effort:

- **Mobile nav parity** and **persistent workflow context** — US-023 (app shell
  and responsive navigation): `apps/web/src/components/app-shell.tsx`,
  `sidebar-nav.tsx`, `mobile-nav.tsx` (portal drawer), with active-state via
  `isNavItemActive` in `apps/web/src/lib/app-data.ts`.
- **Page hierarchy and direct next actions** on dashboard, list, and detail
  surfaces — US-025 (workspace page sweep).
- **Intentional empty / loading / error / success states** and **no layout
  break on long URLs, generated text, snippets, and contacts** — US-025 plus the
  shared primitives and `(app)/loading.tsx` skeleton.
- **Browser verification on desktop and mobile widths** with clean console —
  US-026 validation report (`docs/stories/period-7/US-026-validation-report.md`),
  Playwright screenshots in light and dark.

Carried-forward caveat (same as US-026): the full resume-to-job-to-match E2E
across the AI generation surfaces still needs seeded Supabase match data; those
sub-pages were build- and code-verified but not screenshotted. Their UI rework
is intentionally deferred (Harness backlog #8) until their features are
refactored.
