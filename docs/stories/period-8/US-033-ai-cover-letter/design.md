# Design

> Full schema, Mermaid diagrams (user flow, sequence, AI processing flowchart,
> ER diagram, data-flow summary), example persisted JSON, and the complete prompt
> text are in
> `docs/stories/period-8/flows/US-033-ai-cover-letter-flow.md`. This file
> records decisions and key contracts only.

## Domain Model

- **CoverLetter** — the AI artifact for one match. One active record per match
  (upsert on regenerate). Owns the generated prose, the strategy, key points
  used, claims avoided, tone, confidence score, and provider tag.
- **CoverLetterOutput** (Pydantic) — `cover_letter: str`, `cover_letter_strategy: str`,
  `key_points_used: list[str]`, `claims_avoided: list[str]`,
  `tone: Literal["professional","concise","enthusiastic"]`,
  `confidence_score: float`.
- **No-unsupported-claims rule** — after schema validation, `validate()` checks
  that every skill, company, metric, and certification in `cover_letter` traces
  to `candidate_profile` or `match_analysis.top_strengths`. Untraceable claims
  → `status = needs_review` (not `failed`); `activity_feed.description` carries
  a warning. The rule never blocks persistence of a schema-valid result.
- **TemplatedFallbackProvider** — activated when `gemini_api_key` is unset or
  Gemini fails after one retry. Pulls `top_strengths` from `match_analysis`,
  formats them into a safe prose template with `company_name` / `role_title`.
  Always produces a schema-valid `CoverLetterOutput`; `confidence_score = 0.5`,
  `provider = deterministic`.

## Application Flow

`CoverLetterWorkflow.run(match_id, user_id, regenerate=False)`:

1. US-027 ownership assertion + `ai_workflow_runs` (queued → running).
2. `load_input()`: fetch `candidate_profile`, `job_requirements` (from `jobs`),
   `match_analysis` (from `matches`); raise `missing_match_analysis` (422) if
   null; fetch `resume_strategy` if present (US-031); read `company_name`,
   `role_title`, `job_id` from the match's job row.
3. Provider generate → parse JSON (retry once on invalid JSON) → Pydantic
   validate → fallback to `TemplatedFallbackProvider` on schema failure.
4. No-unsupported-claims check → set `needs_review` flag if applicable.
5. `persist()`: upsert `cover_letters` row; write `activity_feed` with Feature-5
   assistant description pattern (§5.5 of flow doc).
6. US-027 update run (completed / needs_review / failed) + return standard
   envelope `{ workflow_run, result }`.

Regenerate: same flow with `regenerate=True`; creates a new `ai_workflow_runs`
row; overwrites the `cover_letters` row; prior run rows are retained for history.

## Interface Contract

```http
POST /api/matches/{matchId}/cover-letter
GET  /api/matches/{matchId}/cover-letter
POST /api/matches/{matchId}/cover-letter/regenerate
```

All require Clerk JWT; `user_id` from JWT must match `matches.user_id` (403 on
mismatch). Response uses the US-027 envelope `{ workflow_run, result }`.
`workflow_type = cover_letter`.

Optional request body for POST/regenerate:
`{ "tone_preference": "professional | concise | enthusiastic" }` — passed as a
hint in the prompt; model may deviate if signals suggest a different tone.

Error codes (full table in flow doc §6):

| Code | HTTP | retryable |
| --- | --- | --- |
| unauthorized | 403 | false |
| missing_profile | 422 | false |
| missing_job_requirements | 422 | false |
| missing_match_analysis | 422 | false |
| invalid_json | 502 | true |
| schema_validation_failure | 502 | true |
| model_timeout | 503 | true |
| network_failure | 503 | true |
| provider_rate_limit | 503 | true |

`missing_match_analysis` is the cover-letter-specific pre-flight; it is the only
new code added to `apps/api/app/services/ai/errors.py`.

## Data Model

New table `cover_letters` — migration `0015_period8_cover_letter.sql`
(tentative; see `execplan.md` stop conditions):

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | gen_random_uuid() |
| user_id | uuid not null → user_profiles(id) on delete cascade | |
| match_id | uuid not null → matches(id) on delete cascade | |
| job_id | uuid not null → jobs(id) on delete cascade | denormalized |
| cover_letter | text not null | |
| cover_letter_strategy | text not null | |
| key_points_json | jsonb not null default '[]' | |
| claims_avoided_json | jsonb not null default '[]' | |
| tone | text not null | |
| confidence_score | numeric not null | 0.0–1.0 |
| provider | text not null | `gemini \| deterministic` |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | updated on regenerate |

Indexes: `UNIQUE (user_id, match_id)` (one active letter per match);
`(user_id, job_id)` for job-centric lookups. `updated_at` trigger reuses
existing migration pattern.

No changes to existing tables. `ai_workflow_runs` records each attempt with
`workflow_type = cover_letter`, `subject_type = match`, `subject_id = match_id`.

Full ER diagram and example persisted JSON row in the flow doc (§5).

## UI / Platform Impact

New page `apps/web/src/app/(app)/matches/[matchId]/cover-letter/page.tsx`:
server component shell + client island for copy/regenerate. Seven sections
(Strategy panel with confidence badge and tone tag, Generated Cover Letter
textarea, Key Points Used list, Claims Avoided list, Copy button, Save button,
Regenerate button). Five states: empty, loading, success/completed, needs_review
(amber badge), error + Retry.

Navigation: `apps/web/src/app/(app)/matches/[matchId]/page.tsx` — add *Write
Cover Letter* button/link after the match analysis section, visible only when
`match_analysis` is non-null. Uses existing `apps/web/src/lib/ai-workflow-client.mjs`
(built in US-027) for envelope calls.

No other pages changed.

## Observability

Inherits US-027: one redacted log line per run; no raw resume text, candidate
PII, or prompt body in server logs. `ai_workflow_runs` records provider, latency,
confidence. `activity_feed` event written per successful generation with the
§5.5 assistant description pattern. `needs_review` status propagates to the
`workflow_run.status` field in the envelope and to the UI amber badge.

## Alternatives Considered

1. Store cover letters as additive columns on `matches` (same pattern as US-028).
   Rejected — a cover letter is a large text artifact unrelated to scoring; a
   dedicated table keeps the `matches` row narrow and allows future versioning.
2. Fail the run when unsupported claims are detected. Rejected — a schema-valid
   letter with a transparency warning is more useful to the user than a hard
   failure; `needs_review` is the correct severity.
