# US-025 Workspace Page Sweep

## Status

planned

## Lane

normal

## Product Contract

Every protected workspace page must adopt the new design system: brand-consistent
layout, the new primitives, and intentional loading, empty, error, and success
states, while staying dense and scannable for repeated use.

## Relevant Product Docs

- `docs/product/overview.md` (protected surfaces list)
- `docs/product/ui-ux-quality.md` (state and form contracts)

## Acceptance Criteria

- Dashboard, profile, resumes (+ new / detail), jobs (+ new / detail), matches
  (+ new / detail / suggestions / draft / roadmap / interview-prep), tracker,
  settings, and auth pages use the new tokens and primitives.
- Layout-shaped skeleton loading states replace generic placeholders on async
  pages; `Skeleton` is actually used.
- Empty and error states use the new intent-aware patterns with a clear next
  action; success uses the shared alert/popup.
- Page header, section heading, and panel heading sit on distinct type scales.
- Forms keep field names/order; labels above inputs; field + form-level errors;
  consistent control heights.
- Every page is responsive with no overflow or button wrapping, in light + dark.

## Design Notes

- Commands: `npm run lint:web`, `npm run test:web`, `npm run build:web`.
- Queries: existing data helpers unchanged.
- API: none.
- Tables: tracker/jobs/matches tables restyled, same columns and data.
- Domain rules: no scoring, persistence, or workflow changes.
- UI surfaces: all `apps/web/src/app/**` protected pages and their forms.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-025 --unit 1 --integration 1 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Existing form/validation tests still pass. |
| Integration | Server-action redirect/validation tests still pass. |
| E2E | Primary create/update flows verified end to end. |
| Platform | Desktop + mobile screenshots per surface, light + dark. |
| Release | `npm run test:web`, `npm run lint:web`, `npm run build:web`. |

## Harness Delta

Brings every workspace surface onto the shared system; retires page-local
styling.

## Evidence

Add per-surface screenshots and the full test run after implementation.
