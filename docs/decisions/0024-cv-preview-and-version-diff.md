# 0024 Tailored CV In-App PDF Preview And Version Diff

Date: 2026-06-14

## Status

Accepted

## Context

The Tailored CV review page (`/matches/{matchId}/draft-cv`) showed the CV as a
text/HTML "CV preview" plus export buttons (PDF/DOCX/Markdown). Two gaps:

1. **No in-app view of the real PDF.** The only way to see the rendered
   document was to Export, which downloads a file *and* stamps the draft
   `status = exported` + writes a `draft_cv.exported` activity (US-041). A user
   who just wanted to *look* could not, without committing the draft to
   "exported".
2. **No way to see what changed between versions.** `draft_cvs` is append-only
   and versioned (US-039), but regenerating or inline-editing produced a new
   version with no visible "what changed" — the user had to eyeball two renders.

This is a low-risk, additive enhancement (one read-only endpoint + web UI), but
the boundary choices (does previewing count as exporting? where does the diff
run?) are worth recording so later work does not re-derive them.

## Decision

**1. Inline PDF preview is a read, not an export.** Add a dedicated read-only
endpoint `GET /api/draft-cvs/{draft_cv_id}/preview/pdf` that reuses the existing
export render pipeline (`_resolve_render` → `build_render_model` →
`render_pdf` / `render_pdf_paged`, same empty-CV guard) but returns the bytes
with `Content-Disposition: inline` and **does not** call `_stamp_export` — no
status flip, no timestamp, no activity row. The web client fetches it, makes a
blob URL, and embeds it in an `<iframe>` behind a "Preview PDF" button
(on-demand, so a render only happens when asked). Reusing the same pipeline
guarantees the preview is byte-for-byte what Export would produce.

**2. Version Diff runs entirely client-side.** `getDraftCvDetail` already loads
`cv_json` for every version on the page, so no backend call, endpoint, or
migration is needed. A pure module `version-diff.mjs` provides a doc-aware diff
over two serialized versions:

- `draftCvToText(cvJson)` (in `draft-cv-view.mjs`) serializes a version into
  deterministic plain text **using the same renderable gating as the preview**
  (`buildDraftCvView`), so the diff reflects exactly what the user sees, not raw
  JSON or non-renderable bullets.
- A single LCS powers two single-column unified views: **Words** (inline token
  stream, newline-preserving — the on-screen default) and **Lines** (whole-line
  Git-unified), plus `diffCharStats` (added/removed/net characters).

The panel compares **any two CV versions** via FROM/TO pickers (default
previous → latest) and only renders when there are ≥2 versions.

## Alternatives Considered

1. **Reuse the export endpoint for the preview.** Rejected — it stamps the draft
   `exported` and writes an activity; viewing must not have that side effect.
2. **Server-side diff endpoint.** Rejected — every version's `cv_json` is already
   in the page payload, so a round-trip adds latency and a new surface for no
   gain.
3. **Visual (pixel) PDF diff.** Rejected — expensive and not what users need;
   they want to see which words/lines of content changed, which the text diff
   gives directly.
4. **Diff the raw `cv_json`.** Rejected — leaks internal fields and
   non-renderable bullets; serializing the renderable preview keeps the diff
   honest about what actually ships.

## Consequences

Positive:

- Previewing the rendered CV has zero side effects (no premature "exported").
- Version Diff costs nothing server-side and needs no migration.
- One render pipeline backs both Export and Preview, so they can never drift.
- The diff text is exactly the preview content (renderable gating reused).

Tradeoffs:

- The preview endpoint duplicates the PDF branch of `_export` (minus the stamp);
  the two must stay in sync if the render pipeline changes.
- Headless browsers without a PDF plugin show a blank `<iframe>`; real browsers
  render it. (Functionally proven by the route test asserting `%PDF-` bytes.)
- `draftCvToText` is a second serializer alongside the backend Markdown/render
  models; it targets diffing (stable line-per-field), not export fidelity.

## Follow-Up

- US-078 implements the preview endpoint + web viewer.
- US-079 implements the diff util, serializer, and the Version Diff panel.
