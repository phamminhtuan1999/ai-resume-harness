# US-071 Job Intake Source Taxonomy + AI Relevance / Quick-Match Persistence

## Status

planned

## Lane

high-risk

## Product Contract

A job records **how it entered** ApplyWise and **how it was classified**, so job
history and analysis stay explainable. Jobs added from search, URL import, or
pasted JD carry a consistent intake `source`, optional external-provider
identity, the AI Role Relevance result, and the Candidate Quick Match preview.
The schema change is additive and idempotent; existing rows and existing
behavior (extraction, matches, quick match) keep working.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 8, Section 13, 15)
- `docs/product/data-model.md` (jobs table contract)
- `docs/decisions/0023-quick-match-prescore-signals.md` (where quick match lives)

## Acceptance Criteria

- A new additive migration extends `jobs` (or a related table per decision 0025)
  with: `external_source`, `external_job_id`, `external_apply_url`,
  `external_posted_at`, `external_raw_payload (jsonb)`; `ai_relevance_score
  (int)`, `ai_role_category (text)`, `ai_relevance_label (text)`,
  `transition_friendliness (text)`, `research_heavy (bool default false)`,
  `engineering_focused (bool default true)`, `ai_relevance_json (jsonb)`;
  `quick_match_score (int)`, `quick_match_label (text)`,
  `quick_match_summary (text)`, `quick_match_json (jsonb)`.
- The `source` taxonomy is reconciled (decision 0026): the canonical set covers
  `discovered_api`, `manual_url`, `manual_paste`; existing `manual` /
  `manual_url` rows are migrated or mapped without data loss. The check
  constraint is updated to accept the new values.
- Allowed values are constrained or documented: `ai_role_category` and
  `transition_friendliness` follow Section 13; `quick_match_label` follows
  Section 15. Invalid writes are rejected or coerced, never silently mis-stored.
- Persistence shape follows decision 0025: either denormalized columns are the
  display source with `ai_workflow_runs` remaining the audit snapshot, or the
  snapshot stays source-of-truth and only display fields mirror onto `jobs`.
  The decision is recorded before the migration is finalized.
- Migration is idempotent (re-runnable) and reversible-safe; applied to live
  Supabase via `psql "$SUPABASE_DB_URL"` per project convention.
- No regression: existing `source_url`, `normalized_url`, `extraction_*`,
  `structured_json`, `parse_status`, and the quick-match run path are unchanged.

## Design Notes

- Commands: new migration under `apps/web/supabase/migrations/` (next number),
  additive `alter table jobs add column ... if not exists` + check-constraint
  update; backfill/map existing `source` values.
- Queries: data loaders that read jobs (`apps/web/src/lib/data/server.ts`,
  jobs list, job detail) extended to select the new columns where shown.
- API: none directly; producers are US-072/073/074/076/077.
- Tables: `jobs` (or a sibling `job_relevance` table if decision 0025 prefers
  normalization). Decision required.
- Domain rules: AI-relevance vs candidate-match are distinct fields and must not
  be conflated (Principle 2). `research_heavy` / `engineering_focused` drive the
  default hide rules consumed by US-074/US-075.
- UI surfaces: none in this story (columns only); consumers in later stories.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-071 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | `source` value validation; allowed-value coercion for category/label/transition fields; pure mappers from AI/quick-match output → column values. |
| Integration | Migration applies cleanly and idempotently to a fresh and an existing DB; existing rows retain data; new columns nullable/defaulted correctly; check constraint accepts the new `source` set and rejects unknown values. |
| E2E | n/a (no user surface in this story). |
| Platform | n/a |
| Release | Live migration applied via `psql "$SUPABASE_DB_URL"`; row counts and existing job reads unaffected. |

## Harness Delta

Intake #51. **Decisions required before finalizing:** 0025 (persistence shape)
and 0026 (`source` taxonomy). Record each with a `docs/decisions/NNNN-*.md` file
and `scripts/bin/harness-cli decision add`. Update `docs/product/data-model.md`
jobs section once columns land.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
