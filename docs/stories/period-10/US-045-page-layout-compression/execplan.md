# Exec Plan

## Goal

Exports land on the recommended (or overridden) page count via deterministic,
selection-only compression with a protected floor and a user-visible report —
preview/PDF/DOCX still provably showing the same content.

## Scope

In scope:

- `render_config.py` (frozen table keyed by target × density).
- `compress.py` (scoring, floor, levels L0–L3, report).
- `pdf_renderer.render_pdf_paged` measure loop (+ page count from fpdf).
- DOCX consuming the identical compressed model + config sizes.
- Router: `pages` override validation, error codes, export-preview
  `rendering.compression` + `override_warning`; legacy-row behavior.
- Tests per validation.md (file-level assertions are the core proof).

Out of scope:

- UI (US-046); storing overrides/reports; rewording of any text.

## Risk Classification

Risk flags: audit/security (export content **selection** on a PII trust
surface — what the user approved vs. what ships), public contracts (override
param + export-preview payload + new error codes), existing behavior (every
export path), weak proof (novel compression logic), multi-domain. Hard gate:
audit/security → **high-risk** lane.

## Work Phases

1. Discovery: confirm fpdf2 page-count surface (`page_no()`), re-read
   `render_model.py` boundaries, US-043's `rendering_json` shape.
2. Design freeze: config table values and level definitions exactly as
   design.md (taste parameters frozen; tuning is a follow-up).
3. Validation first: invariants list (subset-of-gated, floor, determinism,
   report completeness) as test names.
4. Implementation: config → compress → measure loop → DOCX wiring → router
   override/validation → export-preview block.
5. Verification: pytest file assertions (pypdf page counts, dropped-absent /
   protected-present, parity); full suite; story update.
6. Harness: ai-workflows doc current; trace `--intake 42 --story US-045`.

## Stop Conditions

Pause for human confirmation if:

- The measure loop fails to converge deterministically (same inputs →
  different level/pages across runs).
- Honest page-fitting would require rewriting bullet text (Truth Guard
  bypass — decision 0014 must change first).
- The protected floor regularly overflows even L3 on realistic data (floor
  definition is product behavior, not code).
- Override semantics need storage (contradicts append-only versions).
