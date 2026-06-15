# US-072 AI Role Relevance Classifier + Local Keyword Pre-Filter

## Status

planned

## Lane

normal (stronger validation — new public contract + AI behavior)

## Product Contract

ApplyWise can decide whether a job is **meaningfully related to AI engineering**
(Applied AI, LLM products, RAG, agents, AI platforms, GenAI software work) — a
judgment about the *job itself*, separate from candidate fit. The classifier
runs before any candidate match. To control cost and latency, a deterministic
local keyword pre-filter runs first; the AI classifier only runs on jobs the
pre-filter marks as plausibly AI-related. The result explains *why* a job is or
is not AI-related and which keywords drove the call. Research-heavy and
non-engineering AI roles are detected and flagged so downstream surfaces can
hide them by default for the Applied AI Engineer path.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 5, Section 11-14)
- `docs/product/ai-workflows.md` (workflow contract, deterministic fallback)
- `docs/decisions/0021-ai-model-tiers.md`, `docs/decisions/0022-ai-run-reuse.md`

## Acceptance Criteria

- A new `ai_role_relevance` workflow exists as a `BaseAIWorkflow` subclass
  registered in `model_routing.TASK_TIER` (default tier), with a Pydantic output
  matching Section 13: `is_ai_related`, `ai_relevance_score (0-100)`,
  `ai_role_category` (enumerated set), `transition_friendliness
  (high|medium|low)`, `research_heavy`, `engineering_focused`,
  `relevance_reason`, `detected_ai_keywords[]`, `exclude_reason` (enumerated or
  null), `confidence_score`.
- A pure, deterministic local pre-filter (`.mjs` or Python, per where it runs)
  scores a job against the Section 14 keyword groups (AI core, LLM, RAG, agents,
  engineering signals, exclusion/noise) and returns a pre-score + likely/unlikely
  verdict, with **zero model calls**. The AI classifier is only invoked for
  jobs above the pre-filter threshold.
- A deterministic fallback produces a schema-valid result (rule-based on title +
  required skills + keyword groups) when the model is unavailable, so relevance
  never hard-fails the intake flow.
- Thresholds are applied per Section 14: relevance `>= 75` strong, `60-74`
  possible, `< 60` hidden-by-default; the bucket is exposed as a label.
- Jobs with insufficient data return `exclude_reason = insufficient_job_data`
  and are not given a fabricated score.
- "Show why": the result surfaces a short `relevance_reason` and the top
  `detected_ai_keywords`; excluded jobs store their `exclude_reason` for
  later display under a "show hidden jobs" affordance (consumed by US-075).
- US-067 reuse: re-classifying the same job with unchanged inputs serves the
  persisted result rather than calling the model; `prompt_version` is set.

## Design Notes

- Commands: extend the `ai_workflow_runs.workflow_type` check constraint with
  `ai_role_relevance` (additive migration, like US-068 added `quick_match`).
- Queries: classifier reads a normalized job payload (works pre-save on a
  search/preview payload and post-save on a `jobs` row).
- API: callable internally by the search pipeline (US-074) and the URL/paste
  preview (US-076). A standalone endpoint is optional; if added, follow the
  existing workflow-envelope router pattern.
- Tables: no new domain table required; snapshot in `ai_workflow_runs`
  (display fields may mirror onto `jobs` per decision 0025).
- Domain rules: AI relevance ≠ candidate match (Principle 2). Category set and
  exclude reasons from Section 13. Pre-filter is deterministic and cheap.
- Files (pattern from `assistant_insight_workflow.py` / `quick_match_workflow.py`):
  `apps/api/app/schemas/ai_role_relevance.py`,
  `apps/api/app/services/ai/ai_role_relevance_workflow.py`,
  `apps/api/app/services/ai/ai_role_relevance_deterministic.py`,
  pre-filter helper (keyword groups), register in
  `apps/api/app/services/ai/model_routing.py`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-072 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Pre-filter keyword scoring per group; threshold bucketing (75/60); category + exclude-reason mapping; deterministic fallback returns schema-valid output; insufficient-data path; pre-filter is pure/deterministic. |
| Integration | Workflow runs end-to-end with a fake provider: run row written with `workflow_type='ai_role_relevance'` + default-tier model; reuse hit on unchanged inputs; friendly envelope on provider failure. |
| E2E | Exercised indirectly via US-075/US-076 (relevance shown in search results and URL/paste preview). |
| Platform | n/a |
| Release | Pre-filter adds no model calls; classifier respects tier + reuse so quota stays bounded. |

## Harness Delta

Intake #51. New AI task type + check-constraint extension. If the pre-filter
keyword groups become a contract reused by other surfaces, record a decision.
Update `docs/product/ai-workflows.md` task table with `ai_role_relevance`.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
