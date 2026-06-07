# US-008 Generate Safe Resume Suggestions

## Status

in_progress

## Lane

high-risk

## Product Contract

Authenticated users can generate evidence-based resume improvement suggestions
for a match, view each suggestion with Truth Guard status, and distinguish safe
wording from gaps that require new proof before use.

## Relevant Product Docs

- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Acceptance Criteria

- Given a match exists, when I open `/matches/:id/resume-suggestions`, then I
  can generate suggestions for that match.
- Given suggestions are generated, then the app stores rows in
  `resume_suggestions` with suggested text, reason, evidence, related job
  requirement, and Truth Guard status.
- Given a missing skill has no resume evidence, then its suggestion is marked
  `Do not use yet`.
- Given a matched skill has resume evidence, then its suggestion is marked
  `Safe to use`.

## Design Notes

- Commands: generate resume suggestions for match.
- Queries: get match by id, list suggestions by match id.
- API: server action for MVP web flow; backend AI orchestration can replace the
  deterministic generator later.
- Tables: `matches`, `resume_suggestions`.
- Domain rules: do not invent resume facts; `Do not use yet` suggestions must
  not be included in future generated drafts.
- UI surfaces: `/matches/:id`, `/matches/:id/resume-suggestions`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Suggestion generator assigns Truth Guard statuses from match evidence. |
| Integration | Server action stores suggestions and enforces current-user match ownership. |
| E2E | User generates suggestions and sees persisted Truth Guard rows. |
| Platform | Not required for local MVP proof. |
| Release | Period 3 smoke includes resume suggestions. |

## Harness Delta

No harness change expected.

## Evidence

- `apps/web/src/lib/resume-suggestion-generator.mjs`
- `apps/web/src/components/forms/resume-suggestions-form.tsx`
- `apps/web/src/app/matches/[matchId]/resume-suggestions/page.tsx`
- `apps/web/supabase/migrations/0003_period3_resume_suggestions.sql`
