# US-066 Task-Based Model Routing with Fast/Default/Heavy Tiers

## Status

implemented

## Lane

normal

## Product Contract

ApplyWise does not spend the same model on every AI task. Each AI workflow
type resolves to a configured model tier — **fast** for short, low-stakes
text (activity descriptions, dashboard summary, assistant insight, quick
match), **default** for analysis and generation tasks, and **heavy** as an
opt-in upgrade for Draft CV generation only. Tiers are environment
configuration; no feature service names a concrete Gemini model. When a tier
is not configured it falls back to the default tier, so existing single-model
deployments keep working unchanged.

## Relevant Product Docs

- `applywise_ai_model_gateway_quota_optimization_tasks.md` (Epic 2)
- `docs/decisions/0012-ai-workflow-standards.md` (AI workflow foundation)
- `docs/stories/period-8/` (US-027 foundation, US-028..US-038 workflows)

## Acceptance Criteria

- A single task→tier policy map exists in one place (settings/AI layer), keyed
  by the existing `workflow_type` values plus the standalone extractors
  (job extraction, candidate profile extraction, bullet edit). No feature
  service or workflow subclass hardcodes a model name.
- Environment config supports three tiers, e.g. `GEMINI_FAST_MODEL`,
  `GEMINI_MODEL` (existing default, unchanged meaning), `GEMINI_HEAVY_MODEL`,
  plus `AI_USE_HEAVY_MODEL_FOR_DRAFT_CV` (default `false`).
- Fast-tier tasks: `activity_description`, `dashboard_summary`,
  `assistant_insight`, and US-068's `quick_match`. Default tier: everything
  else. Heavy tier: `resume_draft` (Draft CV) only, and only when the flag is
  enabled and a heavy model is configured.
- Unset `GEMINI_FAST_MODEL` / `GEMINI_HEAVY_MODEL` resolve to the default
  model — current deployments behave identically with no new env vars.
- `ai_workflow_runs.model_name` records the actually-used model per run (it
  already exists; it must now reflect tier resolution).
- `.env.example` documents the new variables.

## Design Notes

- Commands: none (configuration + resolution change).
- Queries: none new.
- API: no shape change; run envelopes already expose `model_name`.
- Tables: none — `ai_workflow_runs.model_provider` / `model_name` already
  exist (migration 0010).
- Domain rules: tier resolution lives next to `GeminiProvider`
  (`apps/api/app/services/ai/providers.py`) or `Settings`
  (`apps/api/app/settings.py`); `BaseAIWorkflow._build_gemini_provider` passes
  the resolved model instead of reading `settings.gemini_model` directly.
  Extractors (`job_extractor.py`, `candidate_profile_extractor.py`,
  `bullet_edit.py`) resolve through the same map.
- UI surfaces: none.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-066 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tier resolution table-test: every workflow_type maps to its tier; unset fast/heavy env falls back to default; draft CV uses heavy only when flag + model are both set. |
| Integration | A workflow run with a fake client records the tier-resolved `model_name` on its `ai_workflow_runs` row. |
| E2E | n/a (no user-visible behavior change). |
| Platform | n/a |
| Release | `.env.example` updated; deploy with no new env vars produces identical model usage. |

## Harness Delta

Intake #50. Record a decision (`docs/decisions/`) if implementation locks a
model policy that future agents must inherit (tier membership per task).

## Evidence

Implemented 2026-06-13.

- Added the single task→tier policy map and resolver
  `apps/api/app/services/ai/model_routing.py` (`TASK_TIER`, `resolve_tier`,
  `resolve_model`). No feature service or workflow names a concrete model.
- Added `GEMINI_FAST_MODEL`, `GEMINI_HEAVY_MODEL`, and
  `AI_USE_HEAVY_MODEL_FOR_DRAFT_CV` to `Settings` and documented all three in
  `apps/api/.env.example`; `GEMINI_MODEL` keeps its meaning as the default tier.
- `GeminiProvider` now takes the resolved `model`; `_build_gemini_provider`,
  `activity_description.py`, `job_extractor.py`,
  `candidate_profile_extractor.py`, and `bullet_edit.py` all resolve through the
  map. `draft_cv_workflow.persist` records the tier-resolved model on the Draft
  CV row instead of reading `settings.gemini_model`.
- Recorded decision `docs/decisions/0021-ai-model-tiers.md` (tier membership;
  heavy maps to the live `draft_cv`, not the retired `resume_draft`).
- Unit: `tests/test_model_routing.py` — table-tests every task→tier, unset
  fast/heavy fall back to default, draft CV uses heavy only when flag + model
  are both set, unknown task → default.
- Integration: a `dashboard_summary` (fast) run records the fast model and a
  `match_analysis` (default) run records the default model on the run row.
- `make_settings` test helper extended with the three tier fields (defaults
  mirror an unconfigured deployment).
- `.venv/bin/python -m pytest -q` → 461 passed; `ruff check` clean.

Pending:

- Deploy-with-no-new-env-vars release check (identical model usage) before
  enabling tiers in any environment.
