# US-016 Core Workflow Responsive UX Rework

## Status

planned

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

Add browser screenshots and verification notes after implementation.
