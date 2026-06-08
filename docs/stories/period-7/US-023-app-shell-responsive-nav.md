# US-023 App Shell And Responsive Navigation

## Status

planned

## Lane

normal

## Product Contract

The authenticated app shell must present the brand cleanly and provide working
navigation at every viewport. Today the sidebar simply disappears below the
`lg` breakpoint with no replacement, leaving mobile users without navigation.

## Relevant Product Docs

- `docs/product/overview.md` (navigation list and primary CTA)
- `docs/product/ui-ux-quality.md`

## Acceptance Criteria

- Sidebar uses the brand `Logo`, the emerald accent for the active item, and
  consistent spacing and motion on hover/active.
- A mobile navigation drawer (or equivalent) gives full nav access below `lg`,
  triggered from a visible control in the header.
- The sticky header keeps the primary "Analyze match" CTA reachable and does not
  exceed the navigation height cap on desktop.
- Nav labels, routes, and the primary CTA destination are unchanged.
- Shell works in light and dark and honors `prefers-reduced-motion`.

## Design Notes

- Commands: `npm run lint:web`, `npm run test:web`, `npm run build:web`.
- Queries: none.
- API: none.
- Tables: none.
- Domain rules: preserve `navItems` labels/order and `/matches/new` CTA target.
- UI surfaces: `apps/web/src/components/app-shell.tsx`, `lib/app-data.ts`, new
  mobile-nav client component.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-023 --unit 0 --integration 0 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Not required unless nav logic is extracted. |
| Integration | Not required. |
| E2E | Keyboard + mouse nav, drawer open/close on mobile width. |
| Platform | Desktop + mobile screenshots, light + dark. |
| Release | `npm run test:web`, `npm run lint:web`, `npm run build:web`. |

## Harness Delta

Closes the mobile-navigation gap flagged in the design audit.

## Evidence

Add desktop/mobile shell screenshots after implementation.
