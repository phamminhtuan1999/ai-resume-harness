# Period 15 - AI Model Tiers, Run Reuse, and Quota Control

## Goal

Keep ApplyWise reliable on constrained Gemini quota by routing each AI task to
the right model tier, reusing persisted AI results when inputs have not
changed, giving job listings a deterministic (zero-AI) fit signal with a capped
opt-in AI quick match, and making the provider layer switchable by
configuration.

Source input: `applywise_ai_model_gateway_quota_optimization_tasks.md`
(AI Model Gateway & Gemini Quota Optimization enhancement document).

Intake: #50 (new initiative, normal lane - data model, existing behavior,
external systems).

## Verification Against the Codebase

The source document was verified against the implementation before slicing.
Most of its epics are already covered and get no new stories:

| Doc epic | Status | Covered by |
| --- | --- | --- |
| 1. Centralized AI Gateway | Implemented | US-027 (`BaseAIWorkflow`, `providers.py`, `ai_workflow_runs`) |
| 3. Unified job analysis package | Implemented | US-047..US-049 (`analysis_package.py`, decision engine) |
| 6. Rate limit / quota error handling | Implemented | US-027 (429 classification, backoff, deterministic fallback, friendly envelopes) |
| 7. One Refresh Analysis button + cached state | Implemented | US-050/US-051 (`refresh-analysis-control`, staleness flag, advanced details) |
| 8. Safe logging | Implemented | US-027 (`WorkflowLogger` redaction allowlist) |

The document's premise that "Gemini Pro is the default for all tasks" is
outdated: a single `GEMINI_MODEL` (default `gemini-3.5-flash`) is used for
every task. The real gaps are tiering, reuse, listing-level pre-score, and
provider switching — Period 15's stories.

## Stories

| Story | Title | Shape |
| --- | --- | --- |
| US-066 | Task-based model routing with fast/default/heavy tiers | Normal flat story |
| US-067 | Version-keyed AI run reuse (skip model calls when inputs unchanged) | Normal flat story |
| US-068 | Job listing local pre-score and capped opt-in AI quick match | Normal flat story |
| US-069 | Provider switch readiness (AI_PROVIDER config and adapter contract) | Normal flat story |

## Scope Summary

- US-066 maps each `workflow_type` to a model tier (fast / default / heavy)
  configured by environment, with the heavy tier opt-in for Draft CV only.
- US-067 adds `input_hash` + `prompt_version` to AI runs and serves the
  persisted result when nothing relevant changed, with an explicit
  force-refresh bypass. Refresh Analysis stays the single user entry point.
- US-068 is a NEW feature (deterministic-first, per product decision): a local
  pre-score badge on job listings with zero automatic AI calls, plus a manual
  per-job AI quick match on the fast tier capped by `AI_QUICK_MATCH_LIMIT`.
- US-069 makes the provider configurable (`AI_PROVIDER`) behind the existing
  `AIProvider` protocol so a future DeepSeek/Groq/Mistral/OpenRouter adapter
  needs no feature-service changes. No second live provider ships in this
  period.

## Validation Shape

Model routing and reuse are unit-heavy (tier resolution, hash composition,
reuse vs re-run decisions) with integration proof on the run rows and one
E2E pass showing an unchanged re-analysis performs no model call. Quick match
needs listing-render-without-AI proof and cap enforcement tests. Provider
readiness is proven by contract tests run against both the Gemini adapter and
a fake second adapter.
