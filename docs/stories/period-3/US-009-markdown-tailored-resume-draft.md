# US-009 Generate Markdown Tailored Resume Draft

## Status

in_progress

## Lane

high-risk

## Product Contract

Authenticated users can generate a Markdown tailored resume draft for a match
from the canonical resume, match context, and Truth Guard suggestions. Drafts
must exclude suggestions marked `Do not use yet`.

## Relevant Product Docs

- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Acceptance Criteria

- Given a match exists, when I open `/matches/:id/resume-draft`, then I can
  generate a Markdown draft.
- Given suggestions exist, when a draft is generated, then `Safe to use`
  suggestions are included as evidence-backed improvements.
- Given suggestions marked `Needs confirmation` exist, then the draft keeps them
  clearly labeled for review instead of presenting them as confirmed facts.
- Given suggestions marked `Do not use yet` exist, then the draft excludes them.
- Given a draft is generated, then a `resume_versions` row is persisted for the
  current user's match, resume, and job.

## Design Notes

- Commands: generate Markdown resume draft for match.
- Queries: get match by id, list resume versions by match id.
- API: server action for MVP web flow; backend AI orchestration can replace the
  deterministic draft generator later.
- Tables: `matches`, `resumes`, `jobs`, `resume_suggestions`,
  `resume_versions`.
- Domain rules: do not invent resume facts; `Do not use yet` suggestions must
  not be included in drafts.
- UI surfaces: `/matches/:id`, `/matches/:id/resume-draft`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Draft generator excludes `Do not use yet` suggestions. |
| Integration | Server action persists a `resume_versions` row with current-user ownership. |
| E2E | User generates a Markdown draft and sees the persisted draft content. |
| Platform | Not required for local MVP proof. |
| Release | Period 3 smoke includes resume draft generation. |

## Harness Delta

No harness change expected.

## Evidence

Evidence will be added after implementation and validation.
