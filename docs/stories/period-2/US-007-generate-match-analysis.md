# US-007 Generate Match Analysis

## Status

in_progress

## Lane

high-risk

## Product Contract

Authenticated users can select a saved resume and saved job, generate a
resume-to-job match analysis, persist the score breakdown, and view strengths,
weaknesses, missing skills, risks, and explanations.

## Relevant Product Docs

- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Acceptance Criteria

- Given I have at least one resume and one job, when I open `/matches/new`, then
  I can choose the source resume and target job.
- Given I generate an analysis, then the app stores a match row with the score
  fields and JSON analysis fields from the product data model.
- Given a match exists, when I open `/matches/:id`, then I can see the overall
  score, score breakdown, strengths, weaknesses, missing skills, risks, and
  explanations.
- Given the analyzer runs without model credentials, then it still returns a
  deterministic local baseline that can be replaced by an LLM parser later.

## Design Notes

- Commands: generate match analysis.
- Queries: list matches, get match by id, load current-user resume/job pairs.
- API: server action for MVP web flow; backend AI orchestration can replace the
  deterministic analyzer later.
- Tables: `resumes`, `jobs`, `matches`.
- Domain rules: scores follow the documented weighted score formula; missing
  skills are not invented; resume evidence must come from canonical resume text.
- UI surfaces: `/matches`, `/matches/new`, `/matches/:id`, dashboard/nav CTA.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Analyzer extracts skills and applies weighted match score deterministically. |
| Integration | Server action stores match, updates parse status, and enforces ownership. |
| E2E | User generates a match and sees a persisted detail report. |
| Platform | Not required for local MVP proof. |
| Release | Period 2 smoke includes match generation. |

## Harness Delta

No harness change expected.

## Evidence

- `apps/web/src/lib/match-analyzer.mjs`
- `apps/web/src/components/forms/match-form.tsx`
- `apps/web/src/app/matches/page.tsx`
- `apps/web/src/app/matches/new/page.tsx`
- `apps/web/src/app/matches/[matchId]/page.tsx`
- `apps/web/supabase/migrations/0002_period2_matches.sql`
- `npm run test:web` passed 23 tests.
- `npm run lint:web` passed.
- `npm run build:web` passed after approved Turbopack escalation.
- Browser smoke loaded `/matches` and `/matches/new`; generating a match showed
  the expected schema error until migration `0002_period2_matches.sql` is applied
  to the live Supabase database.
