# Validation

## Proof Strategy

The story is done when, for a fixture resume + job with completed match analysis,
`CoverLetterWorkflow` produces a schema-valid `CoverLetterOutput`, persists the
`cover_letters` row and a `needs_review`-or-`completed` run, writes an
`activity_feed` event, the no-unsupported-claims check flags correctly, the
`TemplatedFallbackProvider` produces a schema-valid result with no invented
claims when Gemini is unavailable, and the cover letter page renders all seven
sections with all five states reachable. All backend tests use a fake provider;
no live Gemini calls.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `CoverLetterOutput` Pydantic rejects missing required fields; `tone` enum rejects unknown values; `confidence_score` bounds; no-unsupported-claims check flags a claim not in `candidate_profile` or `match_analysis.top_strengths` → `needs_review`; no-unsupported-claims check passes when all claims are traceable → `completed`; `TemplatedFallbackProvider` output is schema-valid and `provider = deterministic`; retry logic: invalid JSON on first attempt → retry once → fallback on second failure; `missing_match_analysis` guard raises 422 when `match_analysis` is null on the match row. |
| Integration | `POST /matches/{matchId}/cover-letter` writes `cover_letters` row + `ai_workflow_runs(completed)` + `activity_feed`; `missing_profile` / `missing_job_requirements` / `missing_match_analysis` return correct HTTP codes and write no cover letter; `POST regenerate` creates a second `ai_workflow_runs` row and overwrites `cover_letters`; `GET /matches/{matchId}/cover-letter` returns saved result; ownership denial (wrong `user_id`) → 403, no DB writes; `GET` returns 404 when no letter exists. |
| E2E | Generate cover letter from the match page → see Strategy panel (confidence badge, tone tag), Generated Cover Letter, Key Points Used, Claims Avoided; click Copy → clipboard confirmation; click Regenerate → confirmation dialog → new letter rendered; `needs_review` amber badge shown when run status is `needs_review`; error + Retry shown when run is `failed` and `retryable = true`. |
| Platform | n/a. |
| Performance | `latency_ms` populated; cover letter page reads persisted `cover_letters` row without re-calling the model. |
| Logs/Audit | No raw cover letter text, resume text, candidate PII, or prompt body in emitted server logs for success and failure runs. |

## Fixtures

- **Backend-engineer resume** + **AI-Engineer JD** requiring RAG/embeddings
  (same fixture base as US-028): provides true gaps (no RAG evidence) and
  verifiable strengths (Python/FastAPI). Ensures no-unsupported-claims check has
  something to catch.
- **`FakeGeminiProvider` variants:**
  - `well_supported`: all claims traceable → `completed`.
  - `unsupported_claim`: one claim not in profile → `needs_review`.
  - `invalid_json_first`: first call returns unparseable JSON, second returns
    valid → tests retry path.
  - `invalid_json_both`: both calls return unparseable JSON → tests fallback
    to `TemplatedFallbackProvider`.
  - `low_confidence`: `confidence_score = 0.4` → `needs_review`.
- **`company_name = "Acme AI"`, `role_title = "Senior Backend Engineer"`** —
  verified present in `cover_letter` text after generation.

## Commands

```text
pytest apps/api/tests/test_cover_letter_workflow.py
node --test apps/web/tests/cover-letter-page.test.mjs
```

Record proof with:
`scripts/bin/harness-cli story update --id US-033 --unit 1 --integration 1 --e2e 0 --platform 0`

## Acceptance Evidence

Implemented 2026-06-09. Backend: `tests/test_cover_letter_workflow.py` (5 tests)
green; full backend suite 137. Migration `0014_period8_cover_letters.sql` applied
via `psql` (table + unique `match_id` + RLS); `GET /rest/v1/cover_letters` → 200.
Web: new `/matches/[matchId]/cover-letter` page + `CoverLetterForm` +
`getCoverLetterDetail` + `generateCoverLetterAction`; tsc + eslint clean; live
endpoint smoke → 401 (wired + Clerk-enforced).

Files: `apps/api/app/schemas/cover_letter.py`,
`apps/api/app/services/ai/cover_letter_workflow.py` + `…_deterministic.py`,
`apps/api/app/services/supabase_data.py` (save/get),
`apps/api/app/routers/matches.py` (endpoints),
`apps/web/supabase/migrations/0014_period8_cover_letters.sql`,
`apps/web/src/app/(app)/matches/[matchId]/cover-letter/page.tsx`,
`apps/web/src/components/forms/cover-letter-form.tsx`.

Remaining: authenticated browser E2E.
