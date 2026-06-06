# US-004 Add Or Import Resume Content

## Status

in_progress

## Lane

high-risk

## Product Contract

Authenticated users can paste resume content or import a resume file, normalize
it into canonical Markdown/text, save it under their account, list saved
resumes, and view the saved canonical content.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Acceptance Criteria

- Given I am on `/resumes/new`, when I paste Markdown or plain text and click
  Save, then the resume is stored in my account.
- Given I am on `/resumes/new`, when I upload a PDF, DOCX, or image resume,
  then the backend normalizes it with Docling into canonical Markdown/text and
  stores the result in my account.
- Given the pasted resume text is empty and no file is uploaded, when I click
  Save, then I see a validation error.
- Given I upload an unsupported file type, when I click Save, then I see a
  validation error before processing.
- Given Docling import fails, when the result is shown, then I see a clear
  failure state and no misleading parsed resume is created.
- Given my resume is saved, when I go to `/resumes`, then I see the resume in
  the list.
- Given I open a saved resume, when I visit `/resumes/:id`, then I can view the
  canonical resume content.
- Given I replace the resume text or import a new source file, when I save, then
  the stored canonical content and import metadata are updated without requiring
  a section-by-section editor.

## Design Notes

- Commands: create resume from text, import resume file, update resume, delete
  resume later in settings.
- Queries: list resumes, get resume by id.
- API: `POST /api/resumes`, `GET /api/resumes`, `GET /api/resumes/:resumeId`,
  `PUT /api/resumes/:resumeId`, `DELETE /api/resumes/:resumeId`,
  `POST /api/resumes/import`.
- Tables: `resumes`.
- Domain rules: accepted source types are text, markdown, pdf, docx, and image;
  canonical `raw_text` is required after successful save/import; user can only
  access their own resumes; default `parse_status` is `not_parsed`; binary
  source files are sensitive and may be discarded after conversion unless
  private storage retention is explicitly implemented.
- External library: Docling handles PDF, DOCX, and image import normalization in
  the Python backend.
- UI surfaces: `/resumes`, `/resumes/new`, `/resumes/:id`, dashboard summary.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Resume input validation rejects empty text/no file, rejects unsupported types, and accepts text, Markdown, PDF, DOCX, and image source types. |
| Integration | Resume CRUD and import persist canonical content, import metadata, Docling failure state, and current-user ownership. |
| E2E | User saves pasted text and imports at least one file type, sees the resume in list, opens detail, and sees canonical content. |
| Platform | Required if file upload size, private storage, or deployment runtime constraints differ from local behavior. |
| Release | Period 1 smoke includes resume creation. |

## Harness Delta

This story is now high-risk because it touches sensitive file handling, data
model shape, an external parsing library, and a public user-visible contract.
Implementation should use high-risk planning before code changes.

## Evidence

Scaffold evidence:

- `apps/web/src/app/resumes/page.tsx`
- `apps/web/src/app/resumes/new/page.tsx`
- `apps/api/app/routers/resumes.py`
- `apps/api/app/services/resume_import.py`
- Browser DOM verification showed the resume import page, file input, text
  area, accepted file types, Docling guidance, mobile viewport check, and no
  console errors.
- Playwright screenshot fallback captured
  `/private/tmp/applywise-resume-import-mobile.png` after Browser screenshot
  capture timed out.

Persistence, authenticated ownership, Docling fixture tests, and real file
conversion runtime proof are not implemented yet.
