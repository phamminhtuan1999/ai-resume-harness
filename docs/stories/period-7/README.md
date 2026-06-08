# Period 7 — Commercial-Grade Design System Overhaul

## Goal

Lift ApplyWise from competent shadcn defaults to a commercial-grade, ownable
SaaS product. Establish a real design system (brand, tokens, typography,
primitives, states) and apply it across every public and protected surface, at
light/dark parity, without changing routes, IA, content, or form-field
contracts.

Direction is set by `docs/decisions/0011-design-system-overhaul.md`:
emerald / teal accent, dials variance 7 / motion 4 / density 5, CSS-driven
motion, self-hosted fonts.

## Affected Product Docs

- `docs/product/ui-ux-quality.md` (dials, palette, theme parity, motion)
- `docs/product/overview.md` (surfaces, navigation — unchanged structurally)
- `docs/product/mvp-scope.md` (Period 7 row)

## Candidate Stories

| Story | Title | Lane |
| --- | --- | --- |
| US-021 | Design tokens and theming foundation (light + dark) | normal |
| US-022 | Core UI primitives and brand refresh | normal |
| US-023 | App shell and responsive navigation | normal |
| US-024 | Brand landing and pricing pages | normal |
| US-025 | Workspace page sweep | normal |
| US-026 | Motion, state, accessibility, and dual-theme QA | normal |

## Sequencing

Foundation-first. US-021 through US-024 (tokens, fonts, primitives, app shell,
landing) ship as a reviewable foundation. The team reviews before US-025 sweeps
the remaining ~20 workspace pages. US-026 is the cross-cutting closeout pass.

## Validation Shape

Per story: web unit tests for any new logic, integration where server behavior
is touched (mostly none — this is presentational), browser verification of
primary flows, and desktop + mobile screenshots in **both** light and dark plus
a `prefers-reduced-motion` check.

## Out Of Scope

- No AI, persistence, auth, billing, schema, or route changes.
- No new animation-runtime dependency (Motion / GSAP).
- No renamed nav labels, form fields, or section IDs (analytics + autofill).

## Exit Criteria

Every surface in `docs/product/overview.md` uses the new token and primitive
system, passes WCAG AA contrast in both themes, has intentional
loading/empty/error/success states, is responsive with working mobile
navigation, and contains zero AI-slop tells from the design review.
