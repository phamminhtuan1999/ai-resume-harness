# US-006 Save Contact Information

## Status

in_progress

## Lane

normal

## Product Contract

Authenticated users can optionally save recruiter or contact information with a
job and see it on job detail. Jobs must still save successfully when contact
fields are omitted.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`

## Acceptance Criteria

- Given I am creating a job, when I enter contact name, email, LinkedIn URL,
  and notes, then the contact info is saved with the job.
- Given a job has contact info, when I open the job detail page, then I can see
  contact name, email, LinkedIn URL, and notes.
- Given contact info is optional, when I save a job without contact info, then
  the job still saves successfully.

## Design Notes

- Commands: create job with contact fields, update job contact fields.
- Queries: get job by id, list jobs with contact summary if needed.
- API: covered by job create/update/detail endpoints.
- Tables: `jobs`.
- Domain rules: contact fields are optional; malformed contact email or URL
  should be handled by the validation schema when values are provided.
- UI surfaces: `/jobs/new`, `/jobs/:id`, future `/tracker`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Contact validation allows empty values and validates provided email/URL. |
| Integration | Contact fields persist with the job and remain user-scoped. |
| E2E | User saves a job with and without contact info and sees the expected detail state. |
| Platform | Not required for local MVP proof. |
| Release | Period 1 smoke includes optional contact save. |

## Harness Delta

No harness change expected.

## Evidence

Scaffold evidence:

- `apps/web/src/app/jobs/new/page.tsx`

Persistence, validation, job detail display, and authenticated ownership proof
are not implemented yet.
