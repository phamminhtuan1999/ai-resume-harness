# US-030 Job Assistant Insight Card

## Status

implemented — backend feature + API, the insight card on `/matches/[matchId]`,
and unit tests done; migration `0013` applied to the Supabase database and the
`assistant_insights` table is reachable via REST (HTTP 200). Remaining: browser
E2E of generate → view → regenerate.

## Lane

normal

## Product Contract

Each job/match shows a high-level AI assistant card that tells the user what to
do next: whether the job is worth applying to, why, the next best action, the
application strategy, and a risk level. It is the primary "AI assistant" moment
on the detail page, summarizing the analysis the other workflows produced into a
single decision.

This is Feature 8 of `applywise_ai_assistant_update_tasks.md`. It depends on
US-027 (foundation) and US-028 (match analysis); it reads US-029 gaps when
present. It calls the provider through the boundary in
`docs/decisions/0012-ai-workflow-standards.md` — bounded, normal-lane reuse.

## Relevant Product Docs

- `docs/product/ai-workflows.md`
- `docs/product/overview.md` (job/match detail surface)
- `docs/decisions/0012-ai-workflow-standards.md`

## Acceptance Criteria

- Given a match has analysis results, when the insight is generated, then the
  card shows a personalized `assistant_summary`, a `recommendation`
  (`apply_now|tailor_resume_first|build_project_first|low_priority`),
  `why_this_recommendation`, `next_best_action`, `application_strategy`, and a
  `risk_level` (`low|medium|high`).
- Given `recommendation = apply_now`, then next action points to reviewing
  application materials; `tailor_resume_first` → resume suggestions (US-031);
  `build_project_first` → roadmap (US-034); `low_priority` → an explanation of
  why the role may not be worth prioritizing.
- Given the insight is generated, then it is saved and shown prominently at the
  top of the detail page, with a Regenerate action.
- Given generation fails or no key is configured, then the deterministic
  fallback derives an insight from the saved match scores/recommendation, and a
  hard failure shows a friendly error/retry.

## Design Notes

- Commands: `AssistantInsightWorkflow(BaseAIWorkflow)` (US-027),
  `workflow_type=assistant_insight`.
- Queries: `GET /api/matches/{matchId}/assistant-insight`.
- API: `POST /api/matches/{matchId}/assistant-insight`,
  `POST /api/matches/{matchId}/assistant-insight/regenerate`.
- Tables: new `assistant_insights` (`id`, `user_id`, `match_id`,
  `assistant_summary`, `recommendation`, `why_this_recommendation`,
  `next_best_action`, `application_strategy`, `risk_level`, `confidence_score`,
  `provider`, timestamps). Migration `0013_period8_assistant_insight.sql`.
- Input: candidate profile, job requirements, US-028 match analysis, US-029
  missing-skill analysis (if present), plus resume-suggestions/cover-letter/
  application statuses for next-action routing. Output: Feature 8.4 schema.
- Domain rules: map the US-028 `apply_recommendation` and score band onto the
  insight `recommendation` consistently; `next_best_action` must match the
  recommendation routing above; no invented experience.
- UI surfaces: top card on `/matches/[matchId]` (and surfaced on the job detail
  for the active match): recommendation badge, assistant summary, why, next best
  action, application strategy, risk level, regenerate.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-030 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Recommendation→next-action routing for all four recommendations; recommendation derived consistently from match band; deterministic fallback yields a schema-valid insight from saved scores; schema-validation failure → typed error (fake provider). |
| Integration | `POST /assistant-insight` writes `assistant_insights` + run + activity; regenerate replaces saved insight; ownership denial; `GET` returns saved insight; guard when no match analysis exists. |
| E2E | Insight card renders at the top of the match page with badge + sections; each recommendation links to the correct next step; regenerate updates. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. |

## Harness Delta

Reuses US-027 infrastructure; provider boundary inherited from decision 0012.
Adds one migration and one persistence helper. No new decision record.

## Evidence

Backend (2026-06-08): `cd apps/api && .venv/bin/python -m pytest tests -q` →
**119 passed** (incl. `tests/test_assistant_insight_workflow.py`, 16 tests
covering recommendation/risk derivation, the four-way next-action routing, the
match-analysis dependency guard, ownership denial, and postprocess overriding an
optimistic model verdict). `ruff check` clean; `app.main` imports the 3 new
`/assistant-insight` endpoints.

Implemented files: `apps/api/app/schemas/assistant_insight.py`,
`apps/api/app/services/ai/assistant_insight_workflow.py`,
`apps/api/app/services/ai/assistant_insight_deterministic.py`,
`apps/api/app/services/supabase_data.py` (save/get),
`apps/api/app/routers/matches.py` (endpoints),
`apps/web/supabase/migrations/0013_period8_assistant_insight.sql`.

Web (2026-06-08): insight card added to `apps/web/src/app/(app)/matches/[matchId]/page.tsx`
(recommendation + risk badges, summary, why, next best action, strategy, generate
form) reading `getMatchDetail().insight`; `apps/web/src/components/forms/assistant-insight-form.tsx`;
`generateAssistantInsightAction` in `actions.ts`. `node --test` 82 passed,
`tsc --noEmit` + `eslint` clean.

Migration (2026-06-08): `0013_period8_assistant_insight.sql` applied via `psql`
against `SUPABASE_DB_URL` (CREATE TABLE + index + RLS); `match_id` UNIQUE present
(upsert), RLS enabled; `GET /rest/v1/assistant_insights` → HTTP 200.

Remaining: browser E2E.
