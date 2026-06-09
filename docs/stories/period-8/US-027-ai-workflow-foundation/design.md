# Design

## Domain Model

New shared concepts:

- **AIWorkflowRun** — one execution of one AI feature for one subject (a match,
  resume, job, or dashboard). Records lifecycle, provider, timing, confidence,
  and error. The audit/observability record for every AI feature.
- **ActivityEvent** — a user-facing record that an AI step happened, with a
  title, an assistant description (filled by US-037), and importance.
- **AIProvider** — abstraction over output generation. Two implementations:
  `GeminiProvider` (wraps the existing structured-output call) and
  `DeterministicFallbackProvider` (wraps a ported `*.mjs`-equivalent generator).
- **BaseAIWorkflow** — orchestrates the standard flow; subclasses supply
  `workflow_type`, input loading, prompt + schema, deterministic fallback, and
  domain persistence.

Workflow types (string enum, one per Period 8 feature):
`match_analysis`, `missing_skills`, `resume_suggestions`, `resume_draft`,
`cover_letter`, `roadmap`, `interview_prep`, `assistant_insight`,
`dashboard_summary`, `activity_description`.

## Application Flow

`BaseAIWorkflow.run(subject_id, user_profile_id, regenerate=False)`:

1. Authorize: load subject and assert it belongs to `user_profile_id`.
2. Insert `ai_workflow_runs` row (`status=queued`), flip to `running`.
3. `load_input()` — gather profile, resume, job, prior analysis (subclass).
4. Select provider: `GeminiProvider` if `gemini_api_key` set, else fallback.
5. `generate()` → on invalid JSON retry once → on terminal provider error fall
   back to `DeterministicFallbackProvider` (same schema).
6. Validate with the subclass Pydantic model.
7. Map low confidence to `status=needs_review`; otherwise `completed`.
8. `persist()` domain result (subclass) + store output snapshot on the run row.
9. Update run: status, `completed_at`, `latency_ms`, `confidence_score`,
   `model_provider`, `model_name`, `error_message`.
10. Insert `activity_feed` event.
11. Return the standard envelope.

Failure path: any unrecoverable error sets `status=failed` with a typed
`error_message`, still writes the run + an activity event, and returns a
friendly, retryable error envelope. Canonical resume/JD content is never logged.

## Interface Contract

Standard response envelope reused by all Period 8 endpoints:

```json
{
  "workflow_run": {
    "id": "uuid",
    "workflow_type": "match_analysis",
    "status": "completed | needs_review | failed",
    "model_provider": "gemini | deterministic",
    "model_name": "gemini-2.5-flash | deterministic-baseline",
    "latency_ms": 0,
    "confidence_score": 0.0,
    "error_message": null
  },
  "result": { "...domain payload..." }
}
```

Endpoints added in this story (reference + shared read):

```http
POST /api/matches/{matchId}/analyze        # reference workflow (US-028 owns prompt/UI)
GET  /api/matches/{matchId}/ai-workflow     # run status per workflow_type for a match
```

Error envelope:

```json
{ "error": { "code": "schema_validation_failure", "message": "human text", "retryable": true } }
```

Error codes: `missing_profile`, `missing_job_requirements`, `model_timeout`,
`invalid_json`, `schema_validation_failure`, `low_confidence`,
`provider_rate_limit`, `network_failure`, `unauthorized`.

## Data Model

Migration `0010_period8_ai_workflow_foundation.sql`.

### `ai_workflow_runs`

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `workflow_type text not null`
- `subject_type text not null`        — `match | resume | job | dashboard`
- `subject_id uuid`                   — nullable for dashboard-scoped runs
- `status text not null default 'queued'` — `queued|running|completed|needs_review|failed`
- `model_provider text`               — `gemini | deterministic`
- `model_name text`
- `started_at timestamptz`
- `completed_at timestamptz`
- `latency_ms integer`
- `confidence_score numeric`
- `output_snapshot_json jsonb`        — validated output for reuse without re-running
- `error_code text`
- `error_message text`
- timestamps
- index on `(user_id, subject_type, subject_id, workflow_type)`

### `activity_feed`

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `workflow_run_id uuid references ai_workflow_runs(id) on delete set null`
- `activity_type text not null`       — mirrors `workflow_type` + lifecycle
- `related_job_id uuid references jobs(id) on delete set null`
- `related_match_id uuid references matches(id) on delete set null`
- `title text not null`
- `assistant_description text`         — short AI text; filled by US-037, fallback allowed
- `importance text not null default 'low'` — `low|medium|high`
- timestamps
- index on `(user_id, created_at desc)`

No destructive change to existing tables. Domain results keep landing in their
existing tables (`matches`, etc.); `ai_workflow_runs` is additive provenance.

## UI / Platform Impact

- No new screen in this story. The existing match generation action calls
  `POST /api/matches/{matchId}/analyze` instead of running `match-analyzer.mjs`
  inline; the match detail page renders unchanged from persisted `matches`.
- `web` keeps a thin client for the standard envelope, reused by US-028+.

## Observability

- One canonical JSON log line per run: `request_id`, `user_id`, `workflow_type`,
  `subject_type`, `status`, `model_provider`, `latency_ms`, `error_code`.
- Never log `raw_text`, `raw_description`, prompt bodies, or provider payloads
  with resume/JD content. A redaction helper guards the workflow logger.
- `ai_workflow_runs` is the durable per-run record; `activity_feed` is the
  user-facing record. They are distinct from app logs.

## Alternatives Considered

1. Persist AI runs as JSON columns on each domain table instead of a shared
   `ai_workflow_runs` table. Rejected — no cross-feature run history, harder
   observability, and the workflow panel (US-038) needs a uniform run record.
2. One generic `activities` row generated lazily on read. Rejected — the brief
   wants activity written as part of each workflow (Feature 10.6) and importance
   set at creation time.
