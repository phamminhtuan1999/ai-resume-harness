# Exec Plan

## Goal

Ship a reusable backend AI-workflow foundation that every Period 8 AI feature
runs on: provider abstraction (Gemini + deterministic fallback), the
`ai_workflow_runs` and `activity_feed` tables, a `BaseAIWorkflow` flow, a shared
error taxonomy, and observability — proven by routing the existing match
generation through it.

## Scope

In scope:

- Migration adding `ai_workflow_runs` and `activity_feed` tables (Supabase).
- `AIProvider` abstraction wrapping the existing Gemini call pattern, with a
  `DeterministicFallbackProvider` and selection logic (real when
  `gemini_api_key` set, else fallback; fallback also on terminal failure).
- `BaseAIWorkflow` implementing the standard flow from
  `docs/decisions/0012-ai-workflow-standards.md`: queue → run → validate →
  persist result + snapshot → update run status → write activity → return.
- Shared Pydantic base for AI outputs (confidence, model metadata) and a
  validation/retry helper extracted from the current extractors.
- Error taxonomy: missing profile, missing job requirements, model timeout,
  invalid JSON, schema validation failure, low confidence, provider
  quota/rate limit, network failure — each mapped to an API error shape with a
  retryable flag.
- `SupabaseDataClient` helpers for: insert/update `ai_workflow_runs`, insert
  `activity_feed`, read a `matches` row + its resume/job for workflow input.
- Reference workflow: `MatchAnalysisWorkflow` wired to the existing
  `match-analyzer.mjs` logic ported as the deterministic fallback, persisting to
  the existing `matches` table. (Full AI prompt/UI is US-028; here it proves the
  pipeline with the deterministic path as primary fallback.)
- `POST /api/matches/{matchId}/analyze` returning the standard envelope, plus
  `GET /api/matches/{matchId}/ai-workflow` listing run status per workflow_type.
- Logging that redacts resume/JD text; one canonical JSON log line per run.

Out of scope:

- The actual Gemini prompt for match analysis and scoring overhaul (US-028).
- Any other feature workflow (US-029+).
- Cost/token metrics, retries beyond once, multi-provider fan-out.
- Web UI beyond keeping match generation working against the new endpoint.

## Risk Classification

Risk flags:

- Data model — two new tables + migration.
- External systems — Gemini provider boundary.
- Authorization — every AI read/write must enforce user ownership.
- Audit/security — sensitive resume/JD text; redaction rules.
- Public contracts — new API response envelope reused by all later stories.
- Existing behavior — match generation moves from web action to backend.
- Multi-domain — touches resumes, jobs, matches, activity.
- Weak proof — no AI test harness exists yet.

Hard gates:

- External provider behavior → high-risk.
- Data model + authorization → high-risk.
- Decision recorded: `docs/decisions/0012-ai-workflow-standards.md`.

## Work Phases

1. Design schema for `ai_workflow_runs`, `activity_feed`, and the shared output
   base; confirm against `docs/product/data-model.md`.
2. Migration + `SupabaseDataClient` helpers (runs, activity, match-input read).
3. `AIProvider` abstraction + deterministic fallback + selection/retry helper
   (extract from existing extractors; do not duplicate).
4. `BaseAIWorkflow` + error taxonomy + redacting logger.
5. Reference `MatchAnalysisWorkflow` + `POST /api/matches/{matchId}/analyze`
   and `GET /api/matches/{matchId}/ai-workflow`; point the web match action at
   it without changing the match UI.
6. Tests (see `validation.md`): provider selection, retry, fallback, schema
   failure, ownership, run + activity persistence, log redaction.
7. Update `docs/product/data-model.md`; record trace + any friction.

## Stop Conditions

Pause for human confirmation if:

- Enforcing ownership requires changing the existing match/resume/job RLS or
  ownership model.
- The new envelope cannot be adopted by the web app without breaking shipped
  match pages.
- Redaction cannot be guaranteed for an existing log path.
- Persisting AI runs needs to alter or migrate existing `matches` columns
  destructively.
