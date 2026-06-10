# Overview

## Status

planned

## Current Behavior

The PDF renderer uses fpdf2 **core fonts** (Helvetica), which are latin-1.
Typographic glyphs the renderer itself emits (`•`, `–`, `—`) and data-borne
curly quotes/diacritics are transliterated to ASCII by `_safe()` (the
2026-06-09 hotfix for the "?" defect, intake #41 / trace #85): "Đặng Quốc
Tuấn" exports as "Dang Quoc Tuan", bullets as "-". DOCX hardcodes Calibri and
preserves full Unicode. There is no font system: profile values from US-043's
`rendering_json` are generated but unread.

## Target Behavior

A controlled, ApplyWise-owned font system (decision 0014 §2):

- **Vendored libre TTFs** under `apps/api/app/assets/fonts/` with their
  license texts: CMU Serif (`modern_latex` — the LaTeX look), Liberation Sans
  (`ats_clean`, Arial-metric-compatible), Liberation Serif (`classic_latex`,
  Times-metric-compatible). License review is a stop condition before
  vendoring.
- **PDF embeds** the profile's TTFs (regular/bold/italic, subsetted by
  fpdf2). The embedded path is full Unicode: real `•`/`–`/`—`, curly quotes,
  and full diacritics render as themselves — the durable fix for the latin-1
  defect.
- **DOCX names exactly one universally-available font per profile**
  (`modern_latex` → Times New Roman, `ats_clean` → Arial, `classic_latex` →
  Times New Roman) applied to body and heading styles; python-docx cannot
  embed and OOXML has no fallback chain (period README restatement #4).
- **Safe fallback**: a missing/corrupt font asset falls back to core
  Helvetica/Times + the existing `_safe()` transliteration and surfaces a
  note through export-preview — a font problem must never fail an export.
- Renderers read `rendering_json.recommendation.font_profile`; legacy rows
  (null `rendering_json`) and unknown values use the default `modern_latex`.

## Affected Users

- Users with non-ASCII names or punctuation-rich content: exports finally
  render their real glyphs.
- All users: exports use deliberate, ATS-tested typography instead of
  whatever the renderer default was.

## Affected Product Docs

- `docs/product/ai-workflows.md` (export rules: font profiles)
- `docs/decisions/0014-draft-cv-rendering-rework.md` (§2)
- `docs/stories/period-10/README.md` (restatements #3, #4, #5)

## Non-Goals

- Layout/size/margin changes and page measurement (US-045).
- A user-facing font picker (out of scope for the period).
- DOCX font embedding (python-docx cannot; deliberate divergence in 0014).
- Changing the web preview typography beyond the cheap CSS stack (US-046).
