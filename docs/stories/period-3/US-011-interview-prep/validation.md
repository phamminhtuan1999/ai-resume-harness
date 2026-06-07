# Validation

## Proof Strategy

Prove the generator does not invent experience, the table exists, the server
action persists user-scoped prep rows, and the page renders generated output.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Generator returns technical, AI/LLM, system design, and behavioral questions; missing skills become study/proof guidance. |
| Integration | Supabase `interview_preps` table exists and latest row contains populated JSON groups. |
| E2E | Signed-in browser opens `/matches/:id/interview-prep`, generates prep, sees success and rendered question categories. |
| Platform | `npm run build:web` includes `/matches/[matchId]/interview-prep`. |
| Performance | Generator is deterministic in-process for MVP. |
| Logs/Audit | Existing server action warning path covers skipped writes. |

## Fixtures

- Match `98ed9270-a036-4cb3-a644-613854790963`
- Resume `cf5b4eea-652d-405f-94c4-19aa073a088d`
- Job `ffb2c3c7-9914-497a-935a-26707e5b10bf`

## Commands

```text
npm run test:web
npm run lint:web
npm run build:web
scripts/bin/harness-cli story verify US-011
```

## Acceptance Evidence

- `apps/web/src/lib/interview-prep-generator.mjs` generates technical,
  AI/LLM, system design, and behavioral question groups plus weak topics, study
  plan, and answer guidance.
- `apps/web/tests/interview-prep-generator.test.mjs` covers question
  categories, missing-skill study/proof guidance, and answer guidance.
- `apps/web/supabase/migrations/0006_period3_interview_preps.sql` creates
  `public.interview_preps`; migration was applied with `SUPABASE_DB_URL`.
- Supabase verification confirmed latest row
  `8e6b7997-1bf0-41f3-ab65-5fdc12dc0f11` has two questions in each category and
  role-specific answer guidance.
- Signed-in in-app browser generated prep for match
  `98ed9270-a036-4cb3-a644-613854790963` and rendered success, Technical,
  AI/LLM, System design, and Behavioral sections with unsupported-experience
  guardrail copy.
- `npm run test:web`, `npm run lint:web`, and `npm run build:web` passed.
