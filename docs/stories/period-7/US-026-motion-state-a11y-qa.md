# US-026 Motion, State, Accessibility, And Dual-Theme QA

## Status

planned

## Lane

normal

## Product Contract

Before Period 7 exits, ApplyWise must pass a cross-cutting QA pass that proves
the overhaul is correct in both themes, accessible, responsive, and free of
AI-slop tells, with motion that is motivated and respects user preferences.

## Relevant Product Docs

- `docs/product/ui-ux-quality.md`
- `docs/decisions/0011-design-system-overhaul.md`

## Acceptance Criteria

- Every animation is justified (feedback, hierarchy, state, or storytelling) and
  collapses to static under `prefers-reduced-motion`.
- All surfaces pass WCAG AA contrast in light and dark for text, buttons, form
  inputs, placeholders, focus rings, and badges.
- Keyboard reachability and visible focus on all interactive elements.
- Copy self-audit: no typos, broken grammar, em-dashes, or AI-cute filler.
- Pre-flight slop checklist passes (no fake screenshots, decorative grid lines,
  section-number eyebrows, fabricated metrics, scroll cues, locale strips).
- Browser console clean during verified flows.
- A validation report lists checked surfaces, viewports, themes, and any
  deferred issues.

## Design Notes

- Commands: `npm run lint:web`, `npm run test:web`, `npm run build:web`; browser
  verification.
- Queries: none.
- API: none.
- Tables: none.
- Domain rules: QA fixes must not change product scope.
- UI surfaces: all Period 7 changed surfaces and shared components.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-026 --unit 1 --integration 0 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tests for any QA helper introduced. |
| Integration | Not required. |
| E2E | Keyboard + mouse checks across changed flows. |
| Platform | Light + dark + reduced-motion screenshot review; console inspection. |
| Release | `npm run test:web`, `npm run lint:web`, `npm run build:web`. |

## Harness Delta

Creates a durable closeout so theme parity, motion, and accessibility are proven,
not assumed.

## Evidence

Add the Period 7 validation report after implementation.
