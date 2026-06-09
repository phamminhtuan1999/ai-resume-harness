# US-034 AI 4-Week Improvement Roadmap

## Status

planned

## Lane

normal

## Product Contract

For a scored match with a completed missing-skill analysis, ApplyWise generates
a structured 4-week improvement roadmap that closes the most critical skill gaps.
Each week has a goal, skills to cover, tasks, deliverables, a project feature to
build, a future-use resume bullet (labeled "Use after completion"), and an
interview talking point. The result is saved to the existing `roadmaps` table,
regenerable on demand, and displayed on the existing
`/matches/[matchId]/roadmap` page (upgraded from its current deterministic
form).

This is Feature 6 of `applywise_ai_assistant_update_tasks.md`. It depends on
US-027 (foundation), US-028 (match analysis), and US-029 (missing skill
analysis). It upgrades US-010 (deterministic roadmap); the deterministic JS
generator `apps/web/src/lib/roadmap-generator.mjs` (`buildFourWeekRoadmap`)
becomes the typed fallback and must not be deleted. Provider boundary and
envelope format are inherited from `docs/decisions/0012-ai-workflow-standards.md`.

## Relevant Product Docs

- `docs/stories/period-8/flows/US-034-ai-roadmap-flow.md` (full flow, schemas, diagrams, dev tasks)
- `docs/product/ai-workflows.md`
- `docs/product/data-model.md`
- `docs/decisions/0012-ai-workflow-standards.md`
- `applywise_ai_assistant_update_tasks.md` §§6.1–6.10

## Acceptance Criteria

- Given a match I own with completed `match_analysis` and `missing_skills` runs,
  when I call `POST /api/matches/{matchId}/roadmap`, then an `ai_workflow_runs`
  row is created (`queued → running → completed`), a `roadmaps` row is upserted,
  and an `activity_feed` row is written.
- Given a roadmap is generated (Gemini or deterministic), when the output is
  validated, then `weeks` contains exactly 4 elements with `week` values 1, 2,
  3, 4; fewer or more causes a retry then fallback.
- Given the `missing_skill_analysis` input contains at least one gap with
  `severity = critical`, when the roadmap is generated, then at least one of
  `weeks[0].skills_covered` or `weeks[1].skills_covered` overlaps with that
  gap's skill name; if not, `confidence_score` is capped below 0.7 and status is
  `needs_review`.
- Given a generated roadmap, when validated, then every week has a non-empty
  `deliverables` array; an empty list for any week sets status to `needs_review`.
- Given a roadmap is displayed, then each `resume_bullet_after_completion` is
  labeled "Use after completion" and is not presented as current experience.
- Given `gemini_api_key` is unset, when roadmap generation runs, then the
  deterministic provider (Python port of `buildFourWeekRoadmap`) produces
  schema-valid output with exactly 4 weeks and records
  `model_provider = deterministic`.
- Given no completed `missing_skills` run exists, when I call the generate
  endpoint, then the API returns `422` with code
  `missing_skill_analysis_required` and no run, roadmap, or activity row is
  written.
- Given a roadmap already exists, when I click Regenerate and confirm, then
  `POST /api/matches/{matchId}/roadmap/regenerate` creates a new
  `ai_workflow_runs` row and replaces the `roadmaps` row via upsert.
- Given a match I do not own, when I call any roadmap endpoint, then I receive
  `unauthorized` (403) and no row is written.
- Given any roadmap run (success or failure), then no raw resume text, raw job
  description, or prompt body appears in emitted logs.
- Given a roadmap was successfully generated, when I reload the page, then
  `GET /api/matches/{matchId}/roadmap` returns the persisted result without
  re-calling the model.

## Design Notes

Full schemas, Mermaid diagrams (user flow, sequence, AI processing, data flow,
ER), and dev task list: `docs/stories/period-8/flows/US-034-ai-roadmap-flow.md`.

- Commands: `RoadmapWorkflow(BaseAIWorkflow)`, `workflow_type = roadmap`.
  Implements `load_input()`, `build_prompt()`, `deterministic_fallback()`,
  `persist()`. File: `apps/api/app/services/ai/roadmap_workflow.py` (new).
- Queries: `GET /api/matches/{matchId}/roadmap` — returns latest `roadmaps` row
  + latest `ai_workflow_runs` row without re-running generation.
- API:
  - `POST /api/matches/{matchId}/roadmap` — generate or replace roadmap.
  - `GET /api/matches/{matchId}/roadmap` — read persisted roadmap.
  - `POST /api/matches/{matchId}/roadmap/regenerate` — semantic alias for POST
    with `regenerate=True`; creates a new run row and upserts `roadmaps`.
  - Router: `apps/api/app/routers/matches.py` (new or extended); mounted in
    `apps/api/app/main.py`. Response envelope: `{ workflow_run, result }`
    (US-027 standard).
- Schemas: `apps/api/app/schemas/roadmap.py` (new) — `RoadmapWeek`,
  `RoadmapOutput` Pydantic models matching the Feature 6.4 output schema;
  `@model_validator` asserting `len(weeks) == 4`.
- Tables: reuses `roadmaps` (defined in
  `apps/web/supabase/migrations/0005_period3_roadmaps.sql`; `roadmap_json`
  column holds the full 6.4 schema). No core migration required. Tentative
  additive migration `0014_period8_roadmap_ai_columns.sql` may add
  `confidence_score numeric` and `model_provider text` columns — decide at
  implementation time; migration number is the next free slot per
  `docs/stories/period-8/flows/README.md`.
- Persistence helpers (extend `apps/api/app/services/supabase_data.py`):
  `upsert_roadmap(user_id, match_id, title, roadmap_json)` and
  `get_roadmap_for_match(match_id)`.
- Domain rules:
  - EXACTLY 4 weeks; `week` values must be {1, 2, 3, 4}.
  - Critical gaps (`severity = critical`) must appear in week 1 or 2;
    violation → `confidence_score` floor 0.5, status `needs_review`.
  - Every week must have a non-empty `deliverables` array; empty → `needs_review`.
  - `confidence_score ≥ 0.7` → `completed`; < 0.7 → `needs_review`.
  - Resume bullets are future-use only; UI must label them "Use after
    completion".
  - Deterministic fallback: Python port of `buildFourWeekRoadmap`; sorts gaps
    by severity; `confidence_score = 0.5`.
  - US-027 redacting logger: no raw resume/JD/prompt in any log line.
- UI surfaces: `apps/web/src/app/(app)/matches/[matchId]/roadmap/page.tsx`
  (upgraded in place). Sections in order: Roadmap Summary, Recommended Project
  Theme, Week 1–4 cards, Success Criteria, Resume Bullets After Completion,
  Save Roadmap, Regenerate. Week cards render: goal, skills badges,
  tasks, deliverables, project feature, resume bullet ("Use after completion"),
  interview talking point. Dependency guard: if `missing_skills` run not
  complete, show prompt linking to `/matches/[matchId]/gaps` and disable
  Generate button. States: empty, loading, completed, needs_review, failed
  (with Retry when `error.retryable`).
  Form component: `apps/web/src/components/forms/roadmap-form.tsx` (upgrade —
  replace inline deterministic call with `runWorkflow` from
  `apps/web/src/lib/ai-workflow-client.mjs`; remove any direct import of
  `buildFourWeekRoadmap`).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-034 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Exactly-4-weeks enforcement (3 weeks → retry → fallback); critical gap in week 3 → `needs_review`; empty deliverables → `needs_review`; dependency guard (`missing_skill_analysis_required`); ownership denial (no DB writes); deterministic fallback (valid 4-week output, `model_provider = deterministic`); log redaction (no raw resume/JD in log lines). Fake provider, no live Gemini calls. File: `apps/api/tests/test_roadmap_workflow.py`. |
| Integration | `POST /roadmap` writes `ai_workflow_runs` + `roadmaps` + `activity_feed`; regenerate creates new run row and replaces `roadmaps`; `GET /roadmap` returns saved result; ownership denial returns 403; `missing_skill_analysis_required` when no `missing_skills` run. |
| E2E | Generate roadmap from the roadmap page → all sections render (summary, project theme, 4 week cards, success criteria, resume bullets labeled "Use after completion"); regenerate updates content. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. |

## Harness Delta

Reuses US-027 `BaseAIWorkflow`, run/activity writers, error taxonomy,
`generate_structured`, and the US-027 prompt preamble constant. Reuses US-028
match context and US-029 missing-skill output (read from
`ai_workflow_runs.output_snapshot_json`). No new provider decision (boundary
inherited from 0012). Adds `apps/api/app/schemas/roadmap.py`,
`apps/api/app/services/ai/roadmap_workflow.py`, two `SupabaseDataClient` helpers,
three match router endpoints, and front-end upgrades to the existing roadmap page
and form. Tentative additive DB migration at implementation time.

## Evidence

Add pytest and node test output plus a roadmap-page screenshot after validation.
