# US-029 AI Missing Skill Analysis

## Status

implemented — backend feature + API, web `/matches/[matchId]/gaps` page, and
unit tests done; migration `0012` applied to the Supabase database and the
`missing_skill_analyses` table is reachable via REST (HTTP 200). Remaining:
browser E2E of generate → view → regenerate.

## Lane

normal

## Product Contract

For a scored match, ApplyWise generates an AI explanation of what is missing,
why it matters, and how to fix it — not a raw keyword list. Each missing or weak
skill is classified as a `true_gap`, `wording_gap`, or `proof_gap`, carries an
evidence status, importance, why-it-matters, a concrete fix, an optional
suggested project task, and an interview-risk note. Output is saved, regenerable,
and shown on a dedicated gaps view grouped by importance.

This is Feature 2 of `applywise_ai_assistant_update_tasks.md`. It depends on
US-027 (foundation) and US-028 (match analysis). It calls the external provider
through the boundary established in `docs/decisions/0012-ai-workflow-standards.md`
and is therefore a bounded, normal-lane reuse rather than a new provider
decision.

## Relevant Product Docs

- `docs/product/ai-workflows.md` (Missing Skill Analysis section)
- `docs/product/data-model.md`
- `docs/decisions/0012-ai-workflow-standards.md`

## Acceptance Criteria

- Given a match analysis exists, when missing-skill analysis runs, then the AI
  returns a ranked list of missing/weak skills with `summary` and
  `top_3_priority_gaps`.
- Given a skill is absent from the profile, then it is classified `true_gap`;
  given related-but-unclear experience exists, `wording_gap`; given the skill is
  claimed without strong project/work evidence, `proof_gap`.
- Given a gap is shown, then it includes importance
  (`critical|medium|nice_to_have`), evidence status
  (`no_evidence|weak_evidence|strong_evidence`), why it matters, how to fix, and
  interview risk; a project task is suggested when it would prove the skill.
- Given a critical gap, then it includes a concrete fix.
- Given I regenerate, then a new `ai_workflow_runs` row is created and the saved
  result is replaced.
- Given generation fails or no key is configured, then the deterministic
  fallback produces a schema-valid result and the UI shows a friendly error/retry
  on hard failure.

## Design Notes

- Commands: `MissingSkillsWorkflow(BaseAIWorkflow)` (US-027) with
  `workflow_type=missing_skills`.
- Queries: `GET /api/matches/{matchId}/missing-skills`.
- API: `POST /api/matches/{matchId}/missing-skills`,
  `POST /api/matches/{matchId}/missing-skills/regenerate`.
- Tables: new `missing_skill_analyses` (`id`, `user_id`, `match_id`,
  `summary`, `missing_skills_json`, `top_3_priority_gaps_json`,
  `confidence_score`, `provider`, timestamps). Migration
  `0012_period8_missing_skills.sql`.
- Input: candidate profile, job requirements, US-028 match analysis, target
  role. Output: Feature 2.4 schema. Fallback: derive from US-028 `top_gaps` +
  `match-analyzer.mjs` missing-skills classification.
- Domain rules: importance grouping (Critical / Medium / Nice-to-have);
  evidence status must be backed by resume text; no invented skills.
- UI surfaces: `/matches/[matchId]/gaps` — gaps grouped by importance; each card
  shows skill, gap type, importance, evidence status, why it matters, how to fix,
  interview risk, suggested project task; regenerate. (Match-centric route; the
  brief's `/jobs/:id/gaps` maps here.)

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-029 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Gap-type classification preserved; evidence-status requires resume backing; importance grouping; deterministic fallback yields schema-valid gaps; schema-validation failure → typed error (fake provider, no live calls). |
| Integration | `POST /missing-skills` writes `missing_skill_analyses` + run + activity; regenerate replaces saved result; ownership denial; `GET` returns saved analysis; depends-on-match guard when no match analysis exists. |
| E2E | Generate gaps from the gaps page → grouped cards render with all fields; regenerate updates. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. |

## Harness Delta

Reuses US-027 `BaseAIWorkflow`, run/activity writers, and error taxonomy. No new
decision record (provider boundary inherited from 0012). Adds one migration and
one `SupabaseDataClient` persistence helper.

## Evidence

Backend (2026-06-08): `cd apps/api && .venv/bin/python -m pytest tests -q` →
**119 passed** (incl. `tests/test_missing_skills_workflow.py`, 7 tests covering
the match-analysis dependency guard, ownership denial, Gemini persistence +
activity, deterministic gap-type/importance mapping, and empty-gaps). `ruff
check` clean; `app.main` imports the 3 new `/missing-skills` endpoints.

Implemented files: `apps/api/app/schemas/missing_skills.py`,
`apps/api/app/services/ai/missing_skills_workflow.py`,
`apps/api/app/services/ai/missing_skills_deterministic.py`,
`apps/api/app/services/supabase_data.py` (save/get),
`apps/api/app/routers/matches.py` (endpoints),
`apps/web/supabase/migrations/0012_period8_missing_skills.sql`.

Web (2026-06-08): `cd apps/web && node --test tests/*.test.mjs` → **82 passed**
(incl. `tests/missing-skills-view.test.mjs` + `runMatchSubWorkflow` cases);
`npx tsc --noEmit` clean; `npx eslint` clean. Web files:
`apps/web/src/app/(app)/matches/[matchId]/gaps/page.tsx`,
`apps/web/src/components/forms/missing-skills-form.tsx`,
`apps/web/src/lib/missing-skills-view.mjs`,
`apps/web/src/lib/actions.ts` (`generateMissingSkillsAction`),
`apps/web/src/lib/data/server.ts` (`getMissingSkillsDetail`),
`apps/web/src/lib/ai-workflow-client.mjs` (`runMatchSubWorkflow`).

Migration (2026-06-08): `0012_period8_missing_skills.sql` applied via `psql`
against `SUPABASE_DB_URL` (CREATE TABLE + index + RLS); `match_id` UNIQUE present
(upsert), RLS enabled; `GET /rest/v1/missing_skill_analyses` → HTTP 200.

Remaining: browser E2E.
