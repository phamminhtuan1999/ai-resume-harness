# Exec Plan

## Goal

A server-authoritative, truth-guard-gated PDF export of any draft CV version,
rendered from the durable ApplyWise standard resume template v1, downloadable
from the review page.

## Scope

In scope:

- Shared render-model serializer (`cv_json` → ordered, filtered render model)
  — the single gating point reused by web preview, PDF, and DOCX.
- Standard resume template v1: HTML + CSS (Jinja2 template in `apps/api`),
  ATS constraints codified as a checked contract.
- WeasyPrint dependency + documented install (macOS brew pango/cairo; CI/apt
  equivalents) in `apps/api` README/pyproject.
- `POST /api/draft-cvs/{draft_cv_id}/export/pdf` — render, stream
  (`application/pdf`, `Content-Disposition: attachment`), update
  `last_exported_pdf_at` + status `exported`, write `draft_cv.exported`
  activity event. `export_notes` computed server-side and returned in the
  envelope alongside the file metadata endpoint variant (design.md).
- `empty_cv` guard; warn-on-pending-review UX wiring in the US-040 page
  (dialog: "N items await review and will be excluded — export anyway?").
- Web preview switched to the render model (preview = export guarantee).

Out of scope:

- DOCX (US-042); binary persistence; template variants; editing flows.

## Risk Classification

Risk flags:

- Public contracts (new download endpoint + file response shape).
- Audit/security (PII document generation; log redaction now covers rendered
  artifacts; export must be evidenced in activity feed).
- External systems (new native rendering dependency in the API runtime).
- Weak proof (first renderer; no existing test pattern for file output).
- Existing behavior (US-040 page and preview change).

Hard gates: audit/security-adjacent PII output → high-risk lane. The template
itself is a durable product contract (the brief's "ApplyWise standard
candidate resume format").

## Work Phases

1. Discovery: WeasyPrint install validated in the dev environment **first**
   (stop condition below); confirm pypdf as a test-only dep for content
   assertions.
2. Design: freeze render-model shape + section order + heading vocabulary;
   freeze filename convention (`{candidate-name}-{company}-{job-title}.pdf`,
   slugged).
3. Validation planning: golden-fixture strategy from validation.md before
   code.
4. Implementation: serializer → template → renderer service → endpoint →
   activity/status writes → web wiring (button, dialog, preview swap).
5. Verification: pytest incl. PDF text-extraction assertions; manual
   download smoke; visual check of the rendered PDF against the template
   contract; story update + screenshots.
6. Harness update: product docs, trace, friction backlog.

## Stop Conditions

Pause for human confirmation if:

- WeasyPrint cannot install/run in the dev or deploy environment — decision
  0013 names fpdf2 as the fallback and must be updated before proceeding.
- Any pressure appears to render client-side or store binaries (reverses
  decision 0013 §5/§6).
- The ATS contract conflicts with the design system in a way that tempts
  decorating the document (template stays text-first; escalate instead).
- Filename/content-disposition handling reveals user-data leakage risk in
  logs or URLs (names in query strings, etc.).
