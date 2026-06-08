# US-021 Design Tokens And Theming Foundation

## Status

planned

## Lane

normal

## Product Contract

ApplyWise must have one token-driven design system that expresses the emerald /
teal brand and works at full light/dark parity. Tokens are the single source of
truth for color, typography, spacing, radius, elevation, and motion. Self-hosted
fonts load correctly (the current build references Geist but never loads it).

## Relevant Product Docs

- `docs/product/ui-ux-quality.md`
- `docs/decisions/0011-design-system-overhaul.md`

## Acceptance Criteria

- `globals.css` defines a full token set in light and dark with no orphaned or
  mismatched values (no stray purple, no flat all-gray charts).
- Emerald / teal accent (≈ `oklch(0.60 0.13 165)`) is the single accent in both
  themes; neutrals are one cool-gray family.
- A real font system loads via `next/font`: Geist (UI/body), Geist Mono
  (numerals/metadata), and a display family for headlines, exposed as CSS
  variables and mapped in the Tailwind v4 `@theme`.
- A documented type scale (display / heading / body / caption), spacing scale,
  and one radius scale exist as tokens.
- Motion tokens (durations, easings) and a `prefers-reduced-motion` reset are
  defined.
- All existing pages still render (tokens are backward compatible by name) with
  the new look applied automatically.

## Design Notes

- Commands: `npm run lint:web`, `npm run test:web`, `npm run build:web`.
- Queries: none.
- API: none.
- Tables: none.
- Domain rules: presentation only; no product behavior changes.
- UI surfaces: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-021 --unit 1 --integration 0 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Token/contrast helper tests if any logic is added. |
| Integration | Not required (no server behavior). |
| E2E | Smoke that pages render in both themes. |
| Platform | Light + dark screenshots; build succeeds with fonts loaded. |
| Release | `npm run test:web`, `npm run lint:web`, `npm run build:web`. |

## Harness Delta

Establishes the durable token contract the rest of Period 7 builds on.

## Evidence

Add the foundation build output and dual-theme screenshots after implementation.
