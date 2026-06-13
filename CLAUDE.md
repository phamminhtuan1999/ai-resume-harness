# Agent Instructions

Add project-specific agent instructions here.

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `README.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `scripts/bin/harness-cli query matrix`

Use the Rust Harness CLI at `scripts/bin/harness-cli` as the main operational
tool.
<!-- HARNESS:END -->

## Design Context

Before any UI work, read `PRODUCT.md` (register: product; personality: honest
coach; design principles) and `DESIGN.md` (visual system: Grounded Emerald
accent, Sora/Geist type, border-first elevation, named rules). The North Star
is "The Second Opinion": verdict first, evidence second, mechanics last.
Tokens live in `apps/web/src/app/globals.css` (OKLCH, light/dark parity per
decision 0011); `DESIGN.md` documents them — change tokens in globals.css
first, then keep `DESIGN.md` in sync.
