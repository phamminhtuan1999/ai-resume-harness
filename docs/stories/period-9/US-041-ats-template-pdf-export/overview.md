# Overview

## Status

implemented — shared render-model serializer
(`app/services/export/render_model.py`, the single `is_renderable` gating
boundary) + ATS resume template v1 via **fpdf2** (not WeasyPrint: its native
Pango/cairo libs are unavailable here, so decision 0013's pre-authorized
fallback was used — recorded in 0013 and its Implementation Note) +
`POST /api/draft-cvs/{id}/export/pdf` streaming download +
`GET /export-preview` + `empty_cv` guard + `exported` stamp/activity. Web Export
PDF button uses Clerk token + blob download. Proof: `test_draft_cv_export.py`
(pypdf text-extraction inclusion/exclusion, unicode-name, parity) +
`test_draft_cv_router.py` (stream/stamp/empty_cv). Platform (open-in-viewer +
ATS copy-paste sanity) pending.

## Current Behavior

No ApplyWise surface produces a file. Drafts and cover letters render as
text/`<pre>` blocks; there is no resume template, no PDF/DOCX library in
either app, no download endpoint, and no binary storage (decision 0013
context). US-039 persists structured, truth-guarded `cv_json` versions but
nothing consumes them for output, and US-040's export buttons are disabled
scaffolding.

## Target Behavior

ApplyWise gains its durable **standard resume template v1** — a single-column,
ATS-safe HTML/CSS document contract (standard section headings, no
tables/icons/charts/progress bars, bullets ≤ 2 printed lines, consistent
spacing) — and a PDF export path:
`POST /api/draft-cvs/{draft_cv_id}/export/pdf` filters the stored `cv_json`
through the shared render-model serializer (include `safe_to_use` + approved
`needs_confirmation`; exclude `do_not_use_yet` and unapproved items), renders
the template with WeasyPrint, and streams the file as a download. Export
requires no model call, records `last_exported_pdf_at`, derives status
`exported`, writes a `draft_cv.exported` activity event, computes
`export_notes` server-side (included keywords, excluded keywords, items still
needing review, metrics preserved), and fails with `empty_cv` when filtering
leaves no renderable content. The US-040 page's Export PDF button goes live,
with the warn-on-pending-review dialog. The web preview is restyled to render
from the same render model so preview = PDF.

## Affected Users

- Software engineers exporting the document they will actually submit — the
  first user-visible file ApplyWise produces, and the surface where a
  truth-guard leak would be most damaging.

## Affected Product Docs

- `docs/product/ai-workflows.md` (export rules section)
- `docs/product/data-model.md` (`last_exported_pdf_at`, status `exported`)
- `docs/decisions/0013-draft-cv-export-architecture.md` (§5, §6)
- `docs/product/ui-ux-quality.md` (template is a product surface; ATS
  constraints intentionally override decorative rules inside the document)

## Non-Goals

- DOCX (US-042 — consumes this story's serializer and gating).
- Storing rendered binaries, signed URLs, multiple templates, cover-letter
  export, print stylesheets for other pages.
- Changing truth-guard classification or review flows (US-039/US-040 own
  them).
