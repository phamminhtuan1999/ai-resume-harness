# Overview

## Status

planned

## Current Behavior

The PDF renders with one hardcoded layout (16 mm margins, 10.5/12/19 pt) and
no page awareness: content runs as long as it runs. US-043 stores a
recommended page count nobody enforces; US-044 gives the renderer real fonts.
The export-preview endpoint reports content gating only.

## Target Behavior

Exports honor the page target deterministically (decision 0014 §3–§5):

- A typed **`RenderConfig` keyed by (page target, density)** — margins, font
  sizes (brief's px read as pt: name 18 / heading 12 / body 10 / metadata 9),
  line factors, per-entry bullet caps, project limit, summary cap. The
  240-char bullet cap stays.
- **Selection-only, ordered, deterministic compression** inside the shared
  render-model build: progressive levels (per-entry bullet caps → older-entry
  detail → project limit + skill dedupe → summary sentence-boundary
  truncation). Compression can only *remove* renderable content — never
  rewrite, never add (wording-to-fit is generation-time, US-043's prompt). A
  **protected floor** (bullets with real impact metrics or prioritized-keyword
  evidence) is never dropped; if the floor alone overflows, the export
  proceeds with a `page_overflow` note — the page target is soft, the floor
  is hard.
- A **bounded measure loop**: render the PDF, count its pages, apply the next
  compression level, re-render — until the target fits or levels are
  exhausted. The PDF is the only measurable surface; DOCX receives the
  identical compressed model and equivalent settings (content parity
  guaranteed, page parity best-effort — python-docx has no layout engine).
- A **machine-readable compression report** (steps applied, every dropped
  item, measured pages, overflow flag) returned by export-preview — silently
  shrinking a user-approved CV is a trust violation.
- **User override as a render parameter**: `?pages=N` on export and
  export-preview, validated against the stored policy's allowed range; below
  the recommendation the server computes warning copy. No stored mutation, no
  new version. Legacy rows (null `rendering_json`) keep Period 9 behavior
  (no targeting) and reject `pages` with a typed error.

## Affected Users

- Users whose drafts overflow: the export lands on the recommended length
  with a visible account of what was condensed.
- Users who want the other length: a bounded, warned override.

## Affected Product Docs

- `docs/product/ai-workflows.md` (export rules: compression, override)
- `docs/decisions/0014-draft-cv-rendering-rework.md` (§3, §4, §5)
- `docs/stories/period-10/README.md` (restatements #6–#13)

## Non-Goals

- Rewording/AI compression (Truth Guard bypass — rejected in 0014).
- WYSIWYG paginated browser preview (restatement #15).
- Persisting overrides or compressed variants; UI (US-046).
