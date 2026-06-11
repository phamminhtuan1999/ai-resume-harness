# US-059 Retire the Markdown Resume Draft; Markdown Export from the Tailored CV

## Status

implemented (verified 2026-06-11)

## Lane

normal

## Product Contract

There is exactly one tailored CV artifact per match. The Markdown resume draft
feature (page, generator, versions list) is gone; in its place the Tailored CV
(today's Draft CV) offers **Export as Markdown** alongside PDF and DOCX, and
all three formats contain exactly the same truth-gated content.

## Relevant Product Docs

- `docs/decisions/0019-single-tailored-cv.md`
- `docs/decisions/0012-*` (workflow backend convention, unchanged)

## Acceptance Criteria

- `/matches/{id}/resume-draft` no longer exists; visiting it redirects to
  `/matches/{id}/draft-cv` (no 404 for old bookmarks).
- The resume-draft generator card, `generateResumeDraftAction`, and the
  `tailored-resume` segment are removed; `ResumeDraftWorkflow` is deleted on
  the API with its routes/tests updated.
- The Draft CV export row offers Markdown alongside PDF/DOCX. The Markdown
  document is rendered from the same gated render model: a bullet appears iff
  it is renderable (safe_to_use, or approved needs_confirmation) — byte-for-
  byte the same bullet set as the PDF.
- `match-tabs.mjs` SEGMENT_TO_TAB drops `resume-draft`; Resume Strategy tab
  copy no longer references a Markdown draft.
- `resume_versions` receives no new writes; existing rows are untouched (no
  drop migration this period).
- All existing Draft CV behavior (generation, review, page policy, PDF/DOCX
  export) is unchanged.

## Design Notes

- Commands: remove `generateResumeDraftAction`; extend the export endpoint
  (or add `format=markdown`) on the API export route, reusing
  `render_model.py` gating.
- Queries: remove `getResumeDraftDetail`; remove resume_versions reads.
- API: delete `ResumeDraftWorkflow` + segment registration; add Markdown
  serializer over the existing render model.
- Tables: none (resume_versions dormant).
- UI: delete resume-draft page; add redirect; extend
  `draft-cv-export-buttons.tsx` with Markdown.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Markdown serializer renders only renderable bullets; identical bullet set to the export render model fixtures. |
| Integration | API: the markdown export route returns the gated document; empty-cv/ownership behavior matches the PDF path. |
| E2E | Old route redirects; Markdown export downloads with gated content (PDF↔Markdown bullet-set parity is proven at the API layer, where both documents are text-extractable). |
| Platform | n/a |

## Harness Delta

Intake #47, decision 0019. Removes one workflow from the manifest docs
(`docs/product/*` AI module list) — update them in the same change.

## Evidence

Implemented 2026-06-11.

- **Removed (API):** `ResumeDraftWorkflow`, `resume_draft_deterministic.py`,
  `schemas/resume_draft.py`, the three `/matches/{id}/tailored-resume` routes,
  the `resume_versions` data-client accessors, `test_resume_draft_workflow.py`,
  and the resume-draft fakes. `workflow_type = "resume_draft"` stays in the
  schema Literal so historic run rows keep validating.
- **Removed (web):** resume-draft page + `ResumeDraftForm` +
  `resume-draft-generator.mjs` (+ its test), `generateResumeDraftAction`,
  `getResumeDraftDetail` + `ResumeVersion` type; `match-tabs.mjs` dropped the
  `resume-draft` segment; suggestions-page copy/link now point at the Tailored
  CV. The old route 308-redirects to `draft-cv` via `next.config.ts`.
- **Added:** `app/services/export/markdown_renderer.py` over the shared render
  model; `POST /api/draft-cvs/{id}/export/markdown` (no page/font params,
  status-only stamp — no new column); `Export Markdown` button +
  `exportFileName`/`exportUrl` markdown handling in `draft-cv-view.mjs`.
- **Proof:** API pytest 403 passed (incl. markdown gating/structure/unicode,
  bullet-set parity vs the render model and vs the PDF, router stream/stamp +
  shared empty-cv guard). Web: 219 unit tests, eslint + tsc clean. Playwright
  14/14 incl. new `period13.spec.ts` (old-route redirect; Markdown download
  contains the safe bullet, never the `do_not_use_yet` bullet). Product docs
  (overview, ai-workflows, data-model) updated; `resume_versions` documented
  dormant.
