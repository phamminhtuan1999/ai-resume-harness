# US-078 Tailored CV In-App PDF Preview (Non-Stamping Render Endpoint)

## Status

implemented

## Lane

normal

## Product Contract

On the Tailored CV page a user can see the **real rendered PDF** — exactly what
Export would produce with the currently selected export options — inside the
app, without downloading and without committing the draft. A "Preview PDF"
button renders the current draft on demand and shows it in an inline viewer.
Viewing the preview is a read: it never flips the draft to `exported` and never
writes an activity event — only an actual Export does.

## Relevant Product Docs

- `docs/decisions/0024-cv-preview-and-version-diff.md`
- `docs/decisions/0013-draft-cv-export-architecture.md` (US-041 export pipeline)
- `docs/stories/period-9/` (US-039 draft CVs, US-041 export)

## Acceptance Criteria

- A read-only endpoint `GET /api/draft-cvs/{draft_cv_id}/preview/pdf` returns the
  rendered PDF (`application/pdf`) using the same pipeline as Export
  (`_resolve_render` → render model → `render_pdf`/`render_pdf_paged`), with the
  same ownership check and empty-CV guard.
- The preview request mirrors the export configuration currently selected in
  the UI. If the user changes page count or font profile, the preview uses the
  same `pages` and `font` query semantics as the export request.
- The endpoint sets `Content-Disposition: inline` and does **not** stamp the
  draft: no `status = exported`, no `last_exported_*` timestamp, no
  `draft_cv.exported` activity row.
- The web page shows a "Preview PDF" button that fetches the endpoint (bearer
  token), embeds the PDF in an `<iframe>` via a blob URL, and exposes loading,
  error, and refresh states. The blob URL is revoked on refresh/unmount.
- The render is byte-for-byte what Export produces for the same draft version,
  selected page count, selected font profile, and render pipeline.

## Design Notes

- Commands: none (read-only render).
- Queries: reuses `get_draft_cv_by_id` (ownership).
- API: new `GET /api/draft-cvs/{id}/preview/pdf` (`pages`, `font` optional, same
  override semantics as export).
- Tables: none — no schema change.
- Domain rules: `_preview_pdf` mirrors the PDF branch of `_export` minus
  `_stamp_export`; inline disposition.
- UI surfaces: "Rendered PDF" card on `/matches/{matchId}/draft-cv` with the
  `DraftCvPdfPreview` client component. Page-count/font state should be shared
  with the export controls so the preview is the document the user is about to
  download, not a default/recommended sample.

## Validation

`scripts/bin/harness-cli story update --id US-078 --unit 0 --integration 1 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a (route-level behavior). |
| Integration | Route test: returns `%PDF-` bytes + `application/pdf` + inline for default and selected `pages`/`font` options; does NOT stamp status/timestamp/activity; 404 unowned; 422 empty CV. |
| E2E | On a generated draft, changing page count/font then clicking "Preview PDF" renders a real PDF blob from the same selected options Export would use; status stays unchanged. |
| Platform | n/a |
| Release | None — additive read-only endpoint, no env/schema change. |

## Harness Delta

New initiative (Period 17). Decision `0024-cv-preview-and-version-diff.md`
records the "previewing is not exporting" boundary.

## Evidence

Implemented 2026-06-14.

- Added `_preview_pdf` + `GET /api/draft-cvs/{id}/preview/pdf` in
  `apps/api/app/routers/draft_cvs.py`: reuses `_resolve_render`,
  `build_render_model`, `is_empty_cv`, and the PDF renderers; returns
  `Content-Disposition: inline`; no `_stamp_export` call.
- Web: `apps/web/src/components/draft-cv/pdf-preview.tsx` (`DraftCvPdfPreview`)
  — on-demand fetch → blob → `<iframe>`, with loading/error/refresh and blob
  URL revocation. Wired as a "Rendered PDF" card in the draft-cv page.
- Integration: `tests/test_draft_cv_router.py` — `preview_pdf` returns `%PDF-`
  bytes + inline and leaves `status`/updates/activity untouched; not-found 404;
  empty CV 422. Full API suite `506 passed`.
- Live verification (signed-in browser, `:3000`): "Preview PDF" produced a valid
  37.4 KB `application/pdf` blob (`%PDF-`) embedded in the iframe; no export
  stamp. (Headless preview shows a blank iframe — no PDF plugin — but the route
  test asserts the bytes.)

Pending:

- Preview/export option parity: `DraftCvPdfPreview` currently calls the preview
  endpoint without the selected `pages` and `font` options while Export can use
  user-selected page/font controls. Wire shared page/font state into Preview
  before considering US-078 fully complete under the product contract above.
