# 0012 AI Workflow Standards And Provider Boundary

Date: 2026-06-08

## Status

Accepted

## Context

ApplyWise's analysis features (match analyzer, missing skills, resume
suggestions, resume draft, roadmap, interview prep) shipped in Periods 2–3 as
**deterministic** logic in `apps/web/src/lib/*.mjs` — keyword matching and
templated strings. The brief `applywise_ai_assistant_update_tasks.md` requires
these to produce real, evidence-based AI output, plus several new AI features
(cover letter, job assistant insight, dashboard summary, AI activity feed, AI
workflow panel).

Two AI features already work the "right" way: `job_extractor.py` and
`candidate_profile_extractor.py` in `apps/api` call Gemini with structured
output, schema validation, and retry. The deterministic features do not — and
they run in a different stack (Next.js server actions writing directly to
Supabase). Period 8 needs one consistent way to run every AI feature so the
product is reliable, explainable, and safe with sensitive resume/JD data.

This is a high-risk, architecture-shaping decision: it touches an external
provider, the data model, authorization on AI result reads/writes, and the
source-of-truth for where AI runs. It is recorded before implementation so
US-027–US-038 inherit one boundary instead of re-deciding per story.

## Decision

**1. AI generation lives in the FastAPI backend.** All AI features run in
`apps/api`, reusing the existing Gemini client + retry pattern and validating
output with Pydantic. The Next.js web app calls backend endpoints; it stops
generating analysis inline. The existing extractors are the reference shape.

**2. Real Gemini is primary; deterministic generators are the typed fallback.**
The existing `*.mjs` generators are ported/mirrored as the fallback path used
when no `gemini_api_key` is configured or when generation fails after retries.
Fallback output must satisfy the same Pydantic schema. Working behavior never
regresses, and local/dev runs without a key still function. This satisfies the
brief's "real AI model output, or a development mock with the exact same schema
contract" rule.

**3. Routing stays match-centric.** ApplyWise models analysis as a `matches`
row (resume × job). The brief's `/jobs/:id/*` URLs map onto the existing
`/matches/:id/*` surfaces. The Job Assistant Insight Card (Feature 8) and AI
Workflow Panel (Feature 11) render on the job/match detail over the active
match. No `/jobs/:id/*` analysis migration.

**4. One standard flow for every AI feature** (the brief's Feature 12):

```text
Web action
  -> FastAPI endpoint (auth: enforce user ownership of resume/job/match)
  -> insert ai_workflow_runs row: queued -> running
  -> load required data (profile, resume, job, prior analysis)
  -> build prompt + JSON schema
  -> call provider (retry once on invalid JSON) OR deterministic fallback
  -> validate output with Pydantic
  -> persist domain result + output snapshot
  -> update ai_workflow_runs: completed | needs_review | failed
  -> insert activity_feed event
  -> return result to web
```

**5. Shared schema, persistence, and observability.** Add `ai_workflow_runs`
(workflow_type, status, model_provider, model_name, started_at, completed_at,
latency_ms, confidence_score, error_message) and `activity_feed`. Every prompt
carries the brief's standard preamble (role, source-of-truth, truthfulness,
JSON output, tone). No raw resume or JD text in production logs; AI output is
untrusted until validated; user ownership is enforced on every AI result
read/write.

Gemini stays the provider for MVP (already configured). OpenAI/Claude are
post-MVP provider options behind the same abstraction. LangGraph orchestration
and Browserbase/Stagehand remain post-MVP.

## Alternatives Considered

1. **Keep AI in Next.js server actions, swap deterministic for inline Gemini.**
   Rejected — splits AI across two stacks, duplicates schema/retry/observability,
   and diverges from the working `apps/api` extractor pattern and Feature 12.
2. **Migrate routing to job-centric `/jobs/:id/*` per the brief literally.**
   Rejected for MVP — large refactor of existing match pages and data flow, and
   it collapses the resume × job model the app already relies on.
3. **Real Gemini only, delete deterministic logic.** Rejected — no fallback when
   the key is absent or generation fails; breaks local dev and regresses shipped
   behavior.
4. **Schema-mock provider first, wire Gemini later.** Rejected as the default —
   Gemini is already configured and used in prod; the deterministic generators
   already serve as a schema-valid fallback, so a separate mock adds little.
5. **Real Gemini primary + deterministic fallback, backend, match-centric.**
   Accepted — one boundary, no behavior regression, reuses proven patterns.

## Consequences

Positive:

- One provider boundary, one validation path, one observability contract for all
  twelve AI features.
- Sensitive data handling and ownership checks centralized in the backend.
- Local/dev and provider-outage paths keep working via the typed fallback.
- New backend endpoints mirror `job_extractor`/`candidate_profile_extractor`.

Tradeoffs:

- Match/suggestion/roadmap/interview persistence must move from web server
  actions into the backend `SupabaseDataClient`, which currently lacks those
  helpers.
- Two new shared tables (`ai_workflow_runs`, `activity_feed`) plus per-feature
  tables (`cover_letters`, `dashboard_ai_summary`) require migrations.
- Deterministic generators must be kept schema-aligned as fallbacks rather than
  deleted, adding a maintenance surface until confidence in the model is high.

## Follow-Up

- US-027 implements the shared infra: migrations, `BaseAIWorkflow`, provider
  abstraction, error taxonomy, and `activity_feed` writer.
- US-028–US-038 each add one workflow endpoint + schema + persistence on top.
- Add `ai_workflow_runs` and `activity_feed` to `docs/product/data-model.md`.
- Add per-run cost/token/retry metrics as a later observability story (brief
  Feature 12.6 "recommended future metrics").
