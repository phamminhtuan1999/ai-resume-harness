# Job Relevance / Quick-Match Persistence Shape

Date: 2026-06-15

## Status

Accepted

## Context

US-071 must persist a job's **AI Role Relevance** result and its **Candidate
Quick Match** preview so job history and analysis stay explainable. Two shapes
are possible:

1. **Denormalize** the display fields onto `jobs` columns (the set in Epic 8.1).
2. Keep `ai_workflow_runs` as the **sole** source of truth and mirror nothing
   onto `jobs`.

Quick match already lives in `ai_workflow_runs.output_snapshot_json` (decision
0023) and is reuse-keyed by job + profile (decision 0022). AI relevance
(US-072) will follow the same workflow-run path with `workflow_type =
'ai_role_relevance'`. The jobs list and job detail render per-row; they must not
fan out to `ai_workflow_runs` for every job just to show a relevance label.

## Decision

A **hybrid**: the workflow run stays the audit/reuse source of truth; `jobs`
carries denormalized display columns as the cheap read source.

### `ai_workflow_runs` — audit + reuse source of truth (unchanged path)

Both `ai_role_relevance` and `quick_match` runs persist their full output in
`output_snapshot_json`, with reuse identity per decisions 0022/0023. This path
is not changed by US-071.

### `jobs` — denormalized display columns (the read source)

US-071's additive migration adds the Epic 8.1 set, written at Save time
(US-077) and refreshed when a newer run supersedes them:

- **AI relevance**: `ai_relevance_score (int)`, `ai_role_category (text)`,
  `ai_relevance_label (text)`, `transition_friendliness (text)`,
  `research_heavy (bool default false)`,
  `engineering_focused (bool default true)`, `ai_relevance_json (jsonb)`.
- **Quick match**: `quick_match_score (int)`, `quick_match_label (text)`,
  `quick_match_summary (text)`, `quick_match_json (jsonb)`.
- **External identity**: `external_source`, `external_job_id`,
  `external_apply_url`, `external_posted_at`, `external_raw_payload (jsonb)`.

The `*_json` columns retain the complete payload on the job; the run snapshot
retains the audit trail and reuse identity.

### Rules

- **AI relevance ≠ candidate match** (Principle 2): the two field groups are
  distinct and never conflated in storage or display.
- Pre-save jobs (search results, URL/paste previews) carry these values **in
  memory only**; they are written to `jobs` columns only at Save (US-077).
- Allowed values are constrained or coerced (US-071): `ai_role_category` /
  `transition_friendliness` per Section 13, `quick_match_label` per Section 15 —
  invalid writes are rejected or coerced, never silently mis-stored.

## Consequences

- List/detail reads stay a single-row select; no per-row join to
  `ai_workflow_runs`.
- One extra write at Save time and mild duplication between the `*_json`
  columns and the run snapshot — accepted in exchange for read simplicity and
  keeping the data on the job it describes.
- Any future change to relevance or quick-match output shape updates both the
  run output and the mirror writer that fills these columns.
