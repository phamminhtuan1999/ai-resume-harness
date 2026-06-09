# US-017 Accessibility, Copy, And Visual QA Pass

## Status

implemented (delivered via Period 7 / US-026)

## Lane

normal

## Product Contract

Before Period 5 exits, ApplyWise must pass a focused accessibility, copy, and
visual QA pass for changed surfaces. The pass must catch contrast, focus,
keyboard, typo, label, and console issues before implementation is marked
complete.

## Relevant Product Docs

- `docs/product/ui-ux-quality.md`

## Acceptance Criteria

- Buttons, links, inputs, alerts, badges, and table states have readable
  contrast.
- Interactive elements have visible focus states and keyboard-reachable flows.
- Required fields, helper text, and error text are readable and associated with
  the relevant fields.
- Visible copy is checked for typos, grammar, capitalization, and product tone.
- Browser console is clean during the verified flows except for known
  development-only warnings.
- A short validation report lists checked surfaces, viewport sizes, and any
  deferred issues.

## Design Notes

- Commands: run lint/tests and browser verification; add targeted tests only for
  reusable logic.
- Queries: none expected.
- API: none expected.
- Tables: none expected.
- Domain rules: QA fixes should not alter product scope.
- UI surfaces: all Period 5 changed pages and shared UI components.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-017 --unit 1 --integration 0 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tests for any QA helper introduced. |
| Integration | Not required unless form semantics affect server behavior. |
| E2E | Keyboard and mouse checks for the changed flows. |
| Platform | Desktop and mobile screenshot review plus console inspection. |
| Release | `npm run test:web`, `npm run lint:web`, and `npm run build:web`. |

## Harness Delta

Creates a durable QA closeout story so typo, accessibility, and visual regression
checks are not left as informal polish.

## Evidence

This QA pass was delivered as US-026 (Motion, state, accessibility, and
dual-theme QA) during the Period 7 overhaul. Its closeout report covers every
acceptance criterion of this story:
`docs/stories/period-7/US-026-validation-report.md`.

- **Contrast** — WCAG AA computed from the oklch tokens for body, muted,
  primary, badges, and destructive text in both themes; all text/control pairs
  >= 4.5.
- **Focus and keyboard** — token-driven `focus-visible` ring on all primitives;
  verified visible focus and Tab-reachable sidebar nav via screenshot.
- **Field labels, helper, and error text** — Period 5 form validation work
  (US-015) plus the restyled `input`/`textarea`/`select` primitives.
- **Copy** — zero em/en-dashes across `.tsx`/`.ts`/`.css`; implementation jargon
  removed from user-facing surfaces; no fabricated metrics or testimonials.
- **Clean console** — 0 errors across all screenshot runs.
- **Validation report** — surfaces, viewports, and deferred items listed in the
  US-026 report (mechanical checks: 58/58 tests, lint clean, 23 routes build).

Deferred (carried from US-026): the four AI sub-pages were code-verified but not
screenshotted (need seeded Supabase data); Clerk's hosted widget theming is
Harness backlog #7.
