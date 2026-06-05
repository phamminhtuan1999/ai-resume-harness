# US-005 Add Job Description Manually

## Status

planned

## Lane

normal

## Product Contract

Authenticated users can manually enter job metadata and a pasted job
description, save it under their account, list saved jobs, and view job detail.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Acceptance Criteria

- Given I am on `/jobs/new`, when I enter company, job title, optional job URL,
  and job description text, then I can save the job.
- Given the job description text is empty, when I click Save, then I see a
  validation error.
- Given a job is saved, when I open `/jobs`, then I see the saved job in the
  list.
- Given I open `/jobs/:id`, then I can view the job metadata and raw job
  description.

## Design Notes

- Commands: create job, update job, delete job later in settings.
- Queries: list jobs, get job by id.
- API: `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/:jobId`,
  `PUT /api/jobs/:jobId`, `DELETE /api/jobs/:jobId`.
- Tables: `jobs`.
- Domain rules: company, title, and raw description are required; job URL is
  optional; user can only access their own jobs; default `parse_status` is
  `not_parsed`.
- UI surfaces: `/jobs`, `/jobs/new`, `/jobs/:id`, Analyze New Job CTA.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Job input validation rejects empty required fields and accepts optional URL. |
| Integration | Job CRUD persists and enforces current-user ownership. |
| E2E | User creates a job, sees it in list, opens detail, and sees raw JD. |
| Platform | Not required for local MVP proof. |
| Release | Period 1 smoke includes manual job creation. |

## Harness Delta

No harness change expected.

## Evidence

No implementation proof yet.

