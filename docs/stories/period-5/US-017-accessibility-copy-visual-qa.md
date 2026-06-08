# US-017 Accessibility, Copy, And Visual QA Pass

## Status

planned

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

Add the Period 5 validation report after implementation.
