# US-042 Draft CV DOCX Export

## Status

implemented — `app/services/export/docx_renderer.py` (python-docx) renders the
shared render model; `POST /api/draft-cvs/{id}/export/docx` streams the file,
stamps `last_exported_docx_at`, derives `exported`, writes a `draft_cv.exported`
activity. Proof: `test_draft_cv_export.py` (DOCX content gating, ATS-safe
structure — no tables/images, heading styles, PDF↔DOCX parity) +
`test_draft_cv_router.py` (stream + stamp). Web Export DOCX button shared with
US-041. Platform (open-in-Word) pending.

## Lane

normal

## Product Contract

The user can export any draft CV version as a DOCX file containing **exactly
the same filtered content** as the PDF (US-041): same render model, same
truth-guard gating, same section order and headings, same export notes and
warn-on-pending-review dialog. `POST /api/draft-cvs/{draft_cv_id}/export/docx`
builds the document with `python-docx` from the shared render model and
streams it as a download; the export records `last_exported_docx_at`, derives
status `exported`, and writes a `draft_cv.exported` activity event. The DOCX
is ATS-safe: single column, real heading paragraphs, plain list bullets, no
tables, text boxes, images, or headers/footers carrying content.

This is a bounded sibling of US-041 — it adds a second renderer behind the
established serializer and endpoint pattern, which is why it is normal lane
while US-041 is high-risk (the gating boundary, template contract, and file
endpoint conventions are decided there; decision 0013 §5–§6 inherited).

## Relevant Product Docs

- `docs/stories/period-9/US-041-ats-template-pdf-export/design.md` (render
  model, gating, endpoint + filename conventions — normative for this story)
- `docs/decisions/0013-draft-cv-export-architecture.md`
- `docs/product/ai-workflows.md`, `docs/product/data-model.md`

## Acceptance Criteria

- Given a draft CV with renderable content, when the user clicks Export DOCX,
  then a `.docx` downloads
  (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  attachment filename using US-041's slug convention with `.docx`).
- Given the golden fixture (US-041), the text extracted from the DOCX
  contains every `safe_to_use` and approved `needs_confirmation` bullet and
  none of the `do_not_use_yet`, pending, or rejected text.
- Given the same draft version, the DOCX and the PDF render the identical
  render model: same sections present, same bullet set, same order (parity
  test compares the two renderers' inputs and extracted text sets).
- Given pending `needs_confirmation` items, the same warn dialog as PDF
  appears, quoting the pending count, and confirming exports without them.
- Given a draft whose filtering leaves no renderable content, the endpoint
  returns 422 `empty_cv` and mutates nothing.
- Given a successful export, `last_exported_docx_at` is set, status is
  `exported`, and a `draft_cv.exported` activity event exists with the format
  recorded.
- Given the produced file, it opens without repair warnings in Word/Pages/
  Google Docs (platform smoke), uses heading styles for section titles, and
  contains no tables, images, or content in headers/footers.
- Given a non-owner request, `unauthorized` is returned and nothing is
  rendered; render exceptions return 500 `render_failure` without mutation.
- Given export logs, they contain draft id/format/latency only — no candidate
  or CV text.

## Design Notes

- Commands: `ExportDraftCvDocx(draft_cv_id)` mirrors US-041's flow with a
  `DocxRenderer` (`apps/api/app/services/export/docx_renderer.py`) consuming
  `build_render_model()` — gating logic must not be duplicated or re-filtered
  here.
- Queries: reuses `GET /api/draft-cvs/{draft_cv_id}/export-preview` (US-041).
- API: `POST /api/draft-cvs/{draft_cv_id}/export/docx` in
  `apps/api/app/routers/draft_cvs.py`.
- Tables: none; uses `last_exported_docx_at` from US-039's migration.
- Domain rules: one shared slug/filename helper; one shared empty-cv guard;
  python-docx (`python-docx>=1.1`) added to `apps/api/pyproject.toml` — pure
  Python, no native deps.
- UI surfaces: enable the Export DOCX button on
  `/matches/[matchId]/draft-cv` (US-040 page) beside Export PDF; shared
  download + toast handling; no new page.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-042 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | DocxRenderer: section/heading mapping, bullet list mapping, no-table/no-image invariants (inspect document XML parts), filename slug reuse. |
| Integration | POST export/docx golden-fixture inclusion/exclusion assertions (python-docx readback); PDF↔DOCX parity test (same extracted bullet/text sets); `empty_cv` 422; ownership denial; `last_exported_docx_at` + status + activity row; no-mutation on failure. |
| E2E | Export DOCX from the review page downloads a file that opens cleanly (with the suite-wide browser-E2E gap tracked if not run). |
| Platform | Open the exported file in Word or Google Docs; screenshot as evidence; copy-paste order sanity. |
| Release | Period 9 suite run. |

## Harness Delta

None beyond US-041's conventions; if renderer parity testing surfaces a
serializer gap, fix it in the shared serializer and note it on US-041's
packet, not with a local workaround here.

## Evidence

Add pytest output, the parity test result, and the opened-document screenshot
after validation.
