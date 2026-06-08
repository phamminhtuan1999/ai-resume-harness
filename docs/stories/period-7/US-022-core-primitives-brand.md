# US-022 Core UI Primitives And Brand Refresh

## Status

planned

## Lane

normal

## Product Contract

The shared UI primitives must express the new design system consistently so that
every page inherits one shape, spacing, and state language. Component public
APIs stay stable so consuming pages do not break.

## Relevant Product Docs

- `docs/product/ui-ux-quality.md`
- `docs/decisions/0011-design-system-overhaul.md`

## Acceptance Criteria

- Button, Card, Badge, Input, Textarea, Alert, Progress, Skeleton, Separator,
  and Table are restyled to the new tokens.
- A `Select` primitive exists so dropdowns match input height and styling
  (today text inputs are `h-8` and selects are `h-10`).
- One radius scale and one set of focus/hover/active/disabled/invalid states
  across all interactive primitives; consistent control heights.
- A simple geometric brand `Logo` component replaces the generic `Sparkles`
  glyph in the shell and landing.
- `EmptyState` supports intent variants (create vs no-results) instead of one
  generic dashed box.
- All primitives pass WCAG AA contrast in both themes, including buttons over
  the accent and ghost buttons.

## Design Notes

- Commands: `npm run lint:web`, `npm run test:web`, `npm run build:web`.
- Queries: none.
- API: none.
- Tables: none.
- Domain rules: presentation only; preserve component prop interfaces.
- UI surfaces: `apps/web/src/components/ui/*`, `components/empty-state.tsx`, new
  `components/brand/logo.tsx`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-022 --unit 1 --integration 0 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | `tests/ui-system.test.mjs` extended for new variants/heights. |
| Integration | Not required. |
| E2E | Primitive states verified in a real page flow. |
| Platform | Light + dark component screenshots; contrast spot-checks. |
| Release | `npm run test:web`, `npm run lint:web`, `npm run build:web`. |

## Harness Delta

Centralizes shape and state language so pages stop re-styling primitives
locally.

## Evidence

Add component screenshots and the updated ui-system test run after
implementation.
