# Exec Plan

## Goal

Exports render real typography: embedded libre Unicode fonts per profile in
PDF (durable fix for the latin-1 "?" defect), one predictable font name per
profile in DOCX, and a fallback that can never fail an export.

## Scope

In scope:

- Vendor CMU Serif + Liberation TTFs (regular/bold/italic) with license
  files under `apps/api/app/assets/fonts/`; verify licenses (SIL OFL 1.1)
  before vendoring.
- `app/services/export/fonts.py` registry + resolution.
- `RenderOptions`; pdf_renderer embedding + conditional `_safe()`;
  docx_renderer profile font names on Normal/Title/Heading styles.
- Router: profile from `rendering_json`, `rendering` block in
  export-preview.
- Tests: registry completeness, embedded glyph fidelity, subset presence,
  fallback, DOCX names, parity intact.

Out of scope:

- Sizes/margins/density/page measurement (US-045); UI (US-046).

## Risk Classification

Risk flags: new system dependency class (vendored binary assets +
licensing), audit/security (PII document surface), existing behavior (every
export changes appearance), weak proof (first embedded-font path), public
contracts (export-preview payload). Hard gate: audit/security surface →
**high-risk** lane.

## Work Phases

1. Discovery: confirm fpdf2 embedding API (`add_font` TTF path), pypdf font
   inspection surface; download font releases and read their licenses.
2. Vendor assets + licenses; record exact upstream versions in the asset
   README.
3. Validation first: glyph fixtures (diacritics, en dash, bullet, curly
   quotes) and the expected per-profile assertions.
4. Implementation: fonts.py → RenderOptions → pdf embedding + `_safe` gate →
   DOCX style names → router wiring + export-preview block.
5. Verification: pytest; render one PDF per profile and visually inspect
   (human evidence per period README); full suite; story update.
6. Harness: ai-workflows doc current; trace `--intake 42 --story US-044`.

## Stop Conditions

Pause for human confirmation if:

- Any candidate font's license is not clearly libre/redistributable
  (OFL/X11-class) — do not vendor.
- fpdf2 cannot embed the chosen TTFs (format/feature errors) — renderer
  choice may need revisiting (0013/0014 amendment).
- Embedded-font PDFs fail text extraction in pypdf (would break both tests
  and ATS confidence — the feature's premise).
- Asset size pushes the repo beyond reasonable bounds (> ~15 MB of fonts).
