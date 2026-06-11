# US-059 Retire the Markdown Resume Draft; Markdown Export from the Tailored CV

## Status

planned

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
| Integration | API: export?format=markdown returns the gated document; 404/ownership behavior matches PDF path. |
| E2E | Old route redirects; Markdown export downloads; PDF and Markdown contain the same bullet texts for a seeded draft. |
| Platform | n/a |

## Harness Delta

Intake #47, decision 0019. Removes one workflow from the manifest docs
(`docs/product/*` AI module list) — update them in the same change.

## Evidence

Added after verification.
