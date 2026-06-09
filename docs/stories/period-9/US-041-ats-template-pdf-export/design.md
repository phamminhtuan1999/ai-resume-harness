# Design

## Domain Model

**RenderModel** — the filtered, ordered, presentation-ready projection of one
`draft_cvs.cv_json` version. Produced by one pure function
(`build_render_model(cv_json) -> RenderModel`), it is the **only** path from
stored CV data to any visible document. Rules:

- Include a bullet iff `truth_guard_status == 'safe_to_use'` OR
  (`'needs_confirmation'` AND `user_action == 'approved'`). Everything else —
  including the bullets' existence — is absent from the render model.
- Section order is fixed: contact header, professional summary, skills,
  work experience, projects, education, certifications. Empty sections and
  empty skill categories are omitted entirely (no "None" placeholders).
- An experience/project entry whose bullets are all filtered out renders
  header-only (company/title/dates) — and is counted toward the `empty_cv`
  check only by its bullets.
- `empty_cv` := zero renderable bullets across experience + projects AND an
  empty professional summary. Export refuses with error code `empty_cv` (422).
- Strings are escaped for the target renderer; no markdown interpretation
  inside bullets.

**ExportNotes** — computed (never model-authored, decision 0013):
`included_supported_keywords` (union of `keywords_used` on rendered bullets ∩
prioritized), `excluded_unsupported_keywords` (from
`cv_strategy.keywords_excluded`), `needs_user_review` (texts of still-pending
`needs_confirmation` bullets), `metrics_preserved` (numeric tokens present in
both source corpus and rendered output, from US-039's guard data).

## Application Flow

`ExportDraftCvPdf(draft_cv_id)`:

```text
auth + ownership -> load draft_cvs row -> build_render_model(cv_json)
  -> empty_cv guard -> render template (Jinja2 HTML) -> WeasyPrint HTML->PDF
  -> update last_exported_pdf_at + derive status 'exported'
  -> insert activity_feed 'draft_cv.exported' (related match/job, importance medium)
  -> stream PDF
```

No `ai_workflow_runs` row (no model call). Render failure → 500
`render_failure` with no status/timestamp mutation. Pending-review items do
**not** block export (UI warns; server filters them out regardless) — the
server is the enforcement point, the dialog is courtesy.

## Interface Contract

- `POST /api/draft-cvs/{draft_cv_id}/export/pdf` → `200` binary
  `application/pdf`, `Content-Disposition: attachment; filename="{slug}.pdf"`
  (slug from candidate name + company + title; ASCII-safe; no user data in
  query strings or logs). Errors: `unauthorized`, `not_found`, `empty_cv`
  (422), `render_failure` (500, retryable).
- `GET /api/draft-cvs/{draft_cv_id}/export-preview` → JSON
  `{ render_model_summary: { sections, bullet_counts }, export_notes,
  pending_review_count }` — powers the warn dialog and the export-notes panel
  without producing a file.
- Web: Export PDF button (US-040 page) → if `pending_review_count > 0`, show
  the confirm dialog quoting the count → trigger download via the API client
  with auth headers → success toast; error states per ui-ux-quality.

## Data Model

No new table. Uses `draft_cvs.last_exported_pdf_at` and status `exported`
(both created in US-039's migration). If US-039 shipped without them, add an
additive migration — do not widen any other column.

## UI / Platform Impact

- Template v1 is a backend Jinja2 + CSS asset
  (`apps/api/app/templates/resume_v1.html.j2` + embedded print CSS): single
  column, Letter + A4 tolerant margins, system-safe font stack (no webfont
  fetch at render time), standard headings ("Professional Summary", "Skills",
  "Work Experience", "Projects", "Education", "Certifications"), text bullets
  (`•`), no tables/images/icons/columns/progress bars; bullet style caps at
  2 rendered lines at the template's font metrics (240-char schema cap from
  US-039 keeps this true).
- Web preview component renders from the render model JSON (shared shape via
  the API response), replacing any preview built directly on raw `cv_json` in
  US-040 — preview, PDF, and (later) DOCX agree by construction.

## Observability

`draft_cv.exported` activity event per successful export; one redacted log
line per export request (draft id, format, latency, outcome — never names,
bullet text, or filenames); export failures logged with error code only.

## Alternatives Considered

1. Puppeteer/Playwright print-to-PDF in the web tier — rejected (decision
   0013 §5/alternatives 1, 5).
2. Render once at generation time and store the binary — rejected (0013 §6).
3. Per-renderer filtering (preview filters in React, PDF filters in Python) —
   rejected: two gating implementations will diverge; one serializer is the
   security boundary.
4. Webfonts in the template for brand fidelity — rejected for v1: render-time
   network fetches make export non-deterministic and slow; ATS parsing favors
   plain font stacks.
