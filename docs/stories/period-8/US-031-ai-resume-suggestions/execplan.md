# Exec Plan

## Goal

Upgrade US-008 resume suggestions from deterministic to Gemini-generated,
evidence-backed, Truth-Guard-classified output built on the US-027 foundation —
persisted to the existing `resume_suggestions` table, surfaced on the match
suggestions page with strategy narrative, six grouped sections, per-row
Accept/Reject/Edit, and Regenerate — with a deterministic fallback.

## Scope

In scope:

- `ResumeSuggestionsWorkflow(BaseAIWorkflow)`: input = candidate profile, resume
  text, job requirements, match analysis snapshot, optional missing-skill
  snapshot; prompt = standard preamble + Feature-3 task; schema =
  `ResumeSuggestionOutput`.
- Pydantic models in `apps/api/app/schemas/resume_suggestions.py`:
  `SuggestionItem`, `KeywordItem`, `ResumeSuggestionOutput`.
- Truth Guard enum mapping (`safe_to_use` → `"Safe to use"`,
  `needs_confirmation` → `"Needs confirmation"`,
  `do_not_use_yet` → `"Do not use yet"`) applied before any DB insert.
- Python port of `buildResumeSuggestions` as
  `_deterministic_resume_suggestions(match_data)` in the workflow file; the
  canonical JS source `apps/web/src/lib/resume-suggestion-generator.mjs` is
  unchanged.
- New `SupabaseDataClient` methods: `get_match_with_full_context`,
  `upsert_resume_suggestions` (delete + bulk insert), `get_resume_suggestions_for_match`,
  `patch_suggestion_user_action`.
- Routes added to `apps/api/app/routers/matches.py`:
  `POST /api/matches/{matchId}/resume-suggestions`,
  `GET /api/matches/{matchId}/resume-suggestions`,
  `POST /api/matches/{matchId}/resume-suggestions/regenerate`.
  New router `apps/api/app/routers/resume_suggestions.py` for
  `PATCH /api/resume-suggestions/{suggestionId}`, mounted in `apps/api/app/main.py`.
- New error code `match_analysis_required` (HTTP 422, not retryable) in the
  US-027 error taxonomy.
- Web: five new components under
  `apps/web/src/components/resume-suggestions/`; new
  `apps/web/src/app/(app)/matches/[matchId]/resume-suggestions/actions.ts`;
  page upgraded in place; `resume-suggestions-form.tsx` wired to the AI action.
- Verification that `ai_workflow_runs.workflow_type` check constraint includes
  `resume_suggestions`; additive migration if absent (next free number after
  `0013`).

Out of scope:

- Any schema migration to `resume_suggestions` table (reused as-is).
- Resume draft generation (US-032).
- Missing-skill analysis implementation (US-029).
- Changes to Truth Guard display values already in the DB.

## Risk Classification

Risk flags:

- External systems — Gemini provider.
- Existing behavior — upgrades shipped US-008 suggestions path.
- Public contracts — suggestions API (POST/GET/regenerate) + PATCH per-row
  endpoint; existing page contract.
- Audit/security — sensitive resume text in prompt; must not appear in logs.
- Weak proof — Truth Guard mapping + `do_not_use_yet` exclusion from drafts
  need fixture-driven tests.

Hard gates:

- External provider + changing existing behavior → high-risk lane.
- Provider/observability boundary inherited from
  `docs/decisions/0012-ai-workflow-standards.md`; no new decision record needed.

## Work Phases

1. Pydantic schema (`SuggestionItem`, `KeywordItem`, `ResumeSuggestionOutput`).
2. Prompt (standard preamble + Feature-3 task + schema hint).
3. Truth Guard mapping constant + `_deterministic_resume_suggestions` fallback.
4. `SupabaseDataClient` persistence methods.
5. API endpoints (POST generate, GET, POST regenerate, PATCH per-row).
6. Web: components + actions + page upgrade + form wire-up.
7. Tests (see `validation.md`); update `ai-workflows.md` + `data-model.md`.

## Stop Conditions

Pause for human confirmation if:

- The `resume_suggestions` table is missing a column required by the AI output
  (would require a schema migration decision).
- The `workflow_type` constraint extension requires modifying a deployed
  migration rather than an additive one.
- The PATCH endpoint ownership join through `matches.user_id` is not safe under
  Supabase RLS as currently configured.
