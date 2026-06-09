# Exec Plan

## Goal

Add AI cover letter generation to ApplyWise — a net-new feature producing a
personalized, evidence-grounded prose letter with explicit strategy, key points,
and avoided claims — persisted, copyable, and regenerable from the match detail
page.

## Scope

In scope:

- `CoverLetterWorkflow(BaseAIWorkflow)`: input = candidate profile, job
  requirements, match_analysis, optional resume_strategy, company_name,
  role_title; prompt = standard preamble + Feature-5 task; output schema =
  `CoverLetterOutput` (Pydantic).
- `TemplatedFallbackProvider`: assembles a safe prose letter from
  `match_analysis.top_strengths` + profile skills + company/title only;
  `confidence_score = 0.5`, `provider = deterministic`. No invented claims.
- No-unsupported-claims post-validation: flag run `needs_review` (not `failed`)
  when a claim in `cover_letter` cannot be traced to `candidate_profile` or
  `match_analysis.top_strengths`.
- Migration `0015_period8_cover_letter.sql` (tentative — renumber at
  implementation if 0012–0014 land first; see
  `docs/stories/period-8/flows/README.md`).
- `SupabaseDataClient` methods: `insert_cover_letter`, `get_cover_letter_by_match`,
  `update_cover_letter`.
- `missing_match_analysis` error code added to
  `apps/api/app/services/ai/errors.py` (HTTP 422, retryable=False).
- Router `apps/api/app/routers/cover_letter.py`:
  `POST /api/matches/{matchId}/cover-letter`,
  `GET /api/matches/{matchId}/cover-letter`,
  `POST /api/matches/{matchId}/cover-letter/regenerate`. Mounted in
  `apps/api/app/main.py`.
- Frontend page `apps/web/src/app/(app)/matches/[matchId]/cover-letter/page.tsx`:
  Strategy panel, Generated Letter, Key Points Used, Claims Avoided, Copy, Save,
  Regenerate.
- Navigation link added to `apps/web/src/app/(app)/matches/[matchId]/page.tsx`.

Out of scope:

- Resume suggestions (US-031), tailored resume draft (US-032), roadmap (US-034).
- Any change to `matches` columns or the scoring formula (US-028).
- Rich in-app cover letter editing beyond textarea auto-save.
- A dedicated `/jobs/:id/cover-letter` route — match-centric routing per
  `flows/README.md`.

## Risk Classification

Risk flags:

- External systems — Gemini provider (same boundary as US-028).
- Data model — new `cover_letters` table + migration.
- Audit/security — generates user-facing prose from sensitive resume/JD; same
  log-redaction requirement as US-027.
- Public contracts — new API surface (3 endpoints) + new page.
- Weak proof — no-unsupported-claims logic needs fixtures to verify it flags
  correctly without live model calls.

Hard gates:

- External provider + new data model → high-risk lane.
- Provider/observability boundary **inherited from
  `docs/decisions/0012-ai-workflow-standards.md`** — no new decision record
  needed unless the claims-validation contract changes.

## Work Phases

1. Pydantic `CoverLetterOutput` schema + `TemplatedFallbackProvider`.
2. `CoverLetterWorkflow`: `load_input` (+ `missing_match_analysis` guard),
   `build_prompt`, `validate` (no-unsupported-claims check), `persist`.
3. Migration + `SupabaseDataClient` methods.
4. Router + mount in `main.py`; add `missing_match_analysis` to
   `errors.py`.
5. Frontend page (all states) + navigation link on match detail.
6. Tests (see `validation.md`); update `ai-workflows.md` + `data-model.md`.

## Stop Conditions

Pause for human confirmation if:

- The no-unsupported-claims check produces false positives at an unacceptable
  rate against real fixtures (tracing logic may need tuning).
- `matches` does not carry `job_id` as expected (assumption confirmed by
  migration `0002_period2_matches.sql` — verify before persisting `cover_letters.job_id`).
- Migration number conflict: 0015 is already taken by an earlier story landing
  first (assign the next free number).
- US-031 resume strategy is not yet persisted in a form readable by
  `load_input()` — proceed without `resume_strategy` input rather than
  block.
