# US-024 Brand Landing And Pricing Pages

## Status

planned

## Lane

normal

## Product Contract

The public landing and pricing pages must read as a credible, brand-led
commercial SaaS and clearly communicate the ApplyWise thesis ("apply now or
improve first?") without AI-slop tells or fabricated proof.

## Relevant Product Docs

- `docs/product/overview.md` (positioning, public surfaces)
- `docs/product/mvp-scope.md` (pricing placeholder rules)
- `docs/product/ui-ux-quality.md`

## Acceptance Criteria

- The hero leads with a value-prop headline (not the bare brand name) and a real
  component-preview visual, not a div-based fake screenshot. No decorative grid
  lines.
- Feature content uses varied, non-repeating section layouts; no row of equal
  feature cards. No more than the allowed eyebrow count.
- Emerald brand visuals (gradients/patterns, not AI-purple); tasteful CSS
  entrance/scroll motion honoring `prefers-reduced-motion`.
- Copy is honest: no fabricated testimonials, metrics, or fake-precise numbers.
- Pricing keeps Free/Pro positioning and the `Coming soon` upgrade behavior with
  no checkout; restyled to the new system.
- Zero em-dashes; hero fits the viewport; CTAs pass contrast and do not wrap.
- Works in light and dark.

## Design Notes

- Commands: `npm run lint:web`, `npm run test:web`, `npm run build:web`.
- Queries: none.
- API: none.
- Tables: none.
- Domain rules: pricing must not initiate checkout (MVP rule preserved).
- UI surfaces: `apps/web/src/app/page.tsx`, `apps/web/src/app/pricing/page.tsx`,
  shared landing section components.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-024 --unit 0 --integration 0 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Not required unless landing logic is extracted. |
| Integration | Not required. |
| E2E | Landing and pricing render; CTAs route correctly. |
| Platform | Desktop + mobile screenshots, light + dark; pre-flight slop check. |
| Release | `npm run test:web`, `npm run lint:web`, `npm run build:web`. |

## Harness Delta

Removes the landing-page AI tells (fake screenshot, grid lines, equal cards)
identified in the design audit.

## Evidence

Add landing/pricing screenshots and the pre-flight checklist result.
