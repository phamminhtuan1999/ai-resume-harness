# Design

Full schemas, Mermaid diagrams (user flow, sequence, AI processing, ER), and
dev task list are in
`docs/stories/period-8/flows/US-031-ai-resume-suggestions-flow.md`. This file
records the structural decisions and interface contracts; refer to the flow doc
for JSON examples and diagram source.

## Domain Model

- **ResumeSuggestionOutput** — the AI evaluation for one match. Top-level fields:
  `resume_strategy`, `assistant_summary`, `suggestions[]`, `keywords_to_include[]`,
  `do_not_claim[]`, `confidence_score`. Stored as `output_snapshot_json` on the
  `ai_workflow_runs` row; individual `suggestions[]` items are also written as
  rows to `resume_suggestions`.
- **SuggestionItem** — `{ section, original_text, suggested_text, related_job_requirement,
  reason, evidence, truth_guard_status }`. `section` is one of
  `summary | skills | experience | projects | education | other`.
- **KeywordItem** — `{ keyword, status (supported|needs_confirmation|unsupported), evidence }`.
- **Truth Guard** — AI returns snake_case; the workflow maps to title-case before
  any DB write (`safe_to_use` → `"Safe to use"`, `needs_confirmation` →
  `"Needs confirmation"`, `do_not_use_yet` → `"Do not use yet"`). The existing
  `truthVariant()` UI function already reads the stored title-case values — no
  UI change needed for badge rendering.

## Application Flow

`ResumeSuggestionsWorkflow.run(match_id, user_id, regenerate)`:

1. US-027 authorize + `ai_workflow_runs` (queued → running).
2. `load_input()`: `get_match_with_full_context()` — resume `raw_text`,
   `candidate_profile_json`, `job.structured_json`, match analysis snapshot
   (`workflow_type=match_analysis`), optional missing-skills snapshot
   (`workflow_type=missing_skills`). Guard: if no completed match_analysis run,
   raise `match_analysis_required` (422, not retryable).
3. Provider generate → Pydantic validate `ResumeSuggestionOutput`.
4. Map Truth Guard enum → stored display values.
5. `persist()` via `upsert_resume_suggestions()` (delete old rows, bulk insert);
   store full output in `output_snapshot_json`.
6. US-027 update run (`completed` or `needs_review` if `confidence_score < 0.6`)
   + write `activity_feed`.
7. Return standard envelope `{ workflow_run, result }`.

Regenerate runs the same flow regardless of whether suggestions already exist;
prior `ai_workflow_runs` rows are retained for history.

## Interface Contract

```http
POST /api/matches/{matchId}/resume-suggestions
GET  /api/matches/{matchId}/resume-suggestions
POST /api/matches/{matchId}/resume-suggestions/regenerate
PATCH /api/resume-suggestions/{suggestionId}
```

POST/regenerate response: US-027 envelope; `result` is `ResumeSuggestionOutput`
(`workflow_type: resume_suggestions`). GET response adds `suggestions[]` rows
and top-level `resume_strategy`, `assistant_summary`, `keywords_to_include`,
`do_not_claim` read from the latest run snapshot. PATCH request body:
`{ user_action: "accepted|rejected", suggested_text?: "string" }`; response:
`{ suggestion: { ...updated row... } }`.

Error codes (inherits US-027 taxonomy; adds `match_analysis_required`):

| Code | HTTP | Retryable |
| --- | --- | --- |
| `unauthorized` | 403 | false |
| `missing_profile` | 422 | false |
| `missing_job_requirements` | 422 | false |
| `match_analysis_required` | 422 | false |
| `invalid_json` | 502 | true |
| `schema_validation_failure` | 502 | true |
| `model_timeout` | 503 | true |
| `network_failure` | 503 | true |
| `provider_rate_limit` | 503 | true |

## Data Model

No migration to `resume_suggestions` is required — all AI output fields map to
existing columns in `apps/web/supabase/migrations/0003_period3_resume_suggestions.sql`.

Top-level fields (`resume_strategy`, `assistant_summary`, `keywords_to_include`,
`do_not_claim`) are stored in `ai_workflow_runs.output_snapshot_json` (tentative
choice A from flow doc §5). If US-032 or a later story needs to purge snapshots
independently, an additive migration adding columns to `matches` or a new
`resume_suggestion_metadata` table is the documented path (choice B).

If the `ai_workflow_runs.workflow_type` constraint does not already include
`resume_suggestions` (set by migration `0010_period8_ai_workflow_foundation.sql`),
add an additive migration using the next free number after `0013` at
implementation time (see `docs/stories/period-8/flows/README.md` for canonical
numbering rule).

## UI / Platform Impact

`apps/web/src/app/(app)/matches/[matchId]/resume-suggestions/page.tsx` upgraded
in place with six sections: AI Resume Strategy (`resume-strategy-card.tsx`),
Safe Suggestions, Needs Confirmation, Do Not Use Yet (Accept disabled; warning
treatment), Keywords to Include (`keywords-table.tsx`), Claims to Avoid
(`claims-to-avoid-list.tsx`). Per-row: `suggestion-row.tsx` with Original /
Suggested / Evidence / Requirement / Truth Guard badge / Accept-Reject-Edit. New
`actions.ts` for server actions; `resume-suggestions-form.tsx` wired to AI
action. Retain existing *Open Resume Draft* link.

## Observability

Inherits US-027: one redacted log line per run; `ai_workflow_runs` records
`model_provider`, `latency_ms`, `confidence_score`; `activity_feed` event
("ApplyWise generated {n} resume suggestions for {role} at {company}."). No
`original_resume_text` or raw JD content in logs.

## Alternatives Considered

1. Store `resume_strategy`/`keywords`/`do_not_claim` in new columns on `matches`.
   Deferred (choice B) — snapshot storage covers MVP and avoids a migration;
   revisit if US-032 needs snapshot-independent access.
2. New `resume_suggestion_runs` table instead of reusing `ai_workflow_runs`.
   Rejected — `ai_workflow_runs` with `workflow_type = resume_suggestions` is the
   US-027 pattern; no deviation justified here.
