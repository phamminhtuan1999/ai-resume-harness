# US-069 Provider Switch Readiness (AI_PROVIDER Config and Adapter Contract)

## Status

planned

## Lane

normal

## Product Contract

ApplyWise can change its AI provider by configuration, not by rewriting
features. An `AI_PROVIDER` setting (default `gemini`) selects which adapter
the workflow foundation builds; every adapter implements the same contract
(structured, schema-validated output with the existing transient-retry and
one-shot JSON-repair behavior — supplied by shared gateway code when a
provider lacks native structured output). Feature services and workflow
subclasses contain no provider-specific code. No second live provider ships
in this story; readiness is proven by contract tests against a fake adapter.

## Relevant Product Docs

- `applywise_ai_model_gateway_quota_optimization_tasks.md` (Epic 9)
- `docs/decisions/0012-ai-workflow-standards.md`
- `docs/stories/period-15/US-066-task-based-model-routing.md` (tier resolution
  must stay provider-agnostic)

## Acceptance Criteria

- `AI_PROVIDER` env setting exists (default `gemini`); provider construction
  is centralized (factory/registry in `apps/api/app/services/ai/providers.py`)
  and `BaseAIWorkflow._build_gemini_provider` generalizes to
  `_build_primary_provider` with unchanged behavior for Gemini deployments.
- The adapter contract is explicit: name, model resolution per tier (US-066),
  `generate() -> dict` validated against the workflow's Pydantic model,
  typed `ProviderError` classification (rate limit / timeout / unavailable /
  invalid output) so existing fallback and friendly-error behavior is
  inherited by any adapter.
- JSON validation + one repair retry live in shared gateway code (today's
  `generate_structured`) so an adapter without native structured output still
  returns schema-valid dicts or raises `ProviderInvalidOutputError`.
- A fake/second adapter used in tests proves: switching `AI_PROVIDER` changes
  the executing adapter with zero changes to any workflow subclass, router,
  or extractor; run rows record the new `model_provider`.
- `model_provider` values on `ai_workflow_runs` accommodate future providers
  (relax the check constraint or document the migration path) without
  breaking existing rows.
- Misconfigured provider name fails fast at startup/first use with a clear
  error, and the deterministic fallback path still protects user-facing
  flows.
- `.env.example` documents `AI_PROVIDER`.

## Design Notes

- Commands: possible migration relaxing the
  `ai_workflow_runs.model_provider` check constraint (currently
  `('gemini', 'deterministic')`).
- Queries: none new.
- API: none.
- Tables: `ai_workflow_runs` constraint only.
- Domain rules: keep the existing selection rule (primary when configured,
  deterministic fallback on terminal failure) in `BaseAIWorkflow`; adapters
  never decide fallback. The `AIProvider` protocol already exists — this
  story hardens it into the documented contract and adds the config switch.
- UI surfaces: none.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-069 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Factory resolves adapters by name; unknown name fails fast; contract tests run against both Gemini adapter (fake client) and the fake second adapter: schema validation, repair retry, transient retry, error classification. |
| Integration | With `AI_PROVIDER=fake`, an end-to-end workflow run writes a run row with the fake `model_provider` and unchanged envelope shape; no workflow subclass was modified. |
| E2E | n/a (no user-visible change while Gemini remains configured). |
| Platform | n/a |
| Release | Gemini deployments are byte-for-byte behaviorally unchanged with `AI_PROVIDER` unset. |

## Harness Delta

Intake #50. If the constraint relaxation ships, note it in the migration and
keep decision 0012 accurate about where provider selection lives.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
