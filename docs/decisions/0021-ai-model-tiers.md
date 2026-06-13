# AI Model Tiers (Task-Based Model Routing)

Date: 2026-06-13

## Status

Accepted

## Context

ApplyWise ran every AI task on a single configured model (`GEMINI_MODEL`,
default `gemini-3.5-flash`). Tasks vary widely in stakes and cost: a one-line
activity description and a full Draft CV generation drew the same model. On
constrained Gemini quota this both wastes capacity on cheap tasks and offers no
way to spend a stronger model where it matters. Period 15 (US-066) introduces
tiering as the first of the quota-control stories.

## Decision

Route each AI task to a configured model **tier**, resolved from a single
policy map in `apps/api/app/services/ai/model_routing.py`. No feature service,
workflow subclass, or extractor names a concrete model; all resolve through
`resolve_model(task, settings)`.

Three tiers, configured by environment:

| Tier | Env var | Membership |
| --- | --- | --- |
| fast | `GEMINI_FAST_MODEL` | `activity_description`, `dashboard_summary`, `assistant_insight`, `quick_match` (US-068) |
| default | `GEMINI_MODEL` (unchanged) | everything else, incl. the `job_extraction`, `candidate_profile_extraction`, and `bullet_edit` extractors |
| heavy | `GEMINI_HEAVY_MODEL` | `draft_cv` only, opt-in via `AI_USE_HEAVY_MODEL_FOR_DRAFT_CV` |

Resolution rules:

- fast → `GEMINI_FAST_MODEL` if set, else the default model.
- default → `GEMINI_MODEL`.
- heavy → `GEMINI_HEAVY_MODEL` only when both `AI_USE_HEAVY_MODEL_FOR_DRAFT_CV`
  is true and a heavy model is set; otherwise the default model.
- Any task not in the policy map resolves to the default tier.

`ai_workflow_runs.model_name` (and the Draft CV row's `model_name`) records the
actually-resolved model per run.

### Heavy tier is `draft_cv`, not `resume_draft`

The US-066 story text names the heavy task `resume_draft`. That `workflow_type`
is **retired** (US-059 / decision 0019) — it no longer generates. The live
Draft CV workflow is `draft_cv`, which is what `AI_USE_HEAVY_MODEL_FOR_DRAFT_CV`
and "Draft CV generation" in the product contract refer to. The policy map
therefore assigns the heavy tier to `draft_cv` (functional) and keeps
`resume_draft` mapped to heavy as well so the story's literal task name still
resolves, though no run of that type is produced.

## Alternatives Considered

1. Per-workflow model fields in each subclass. Rejected: scatters model policy
   across the codebase, the exact anti-pattern US-066 forbids ("no feature
   service hardcodes a model name").
2. Thread the resolved `model_name` from `_generate` into every `persist`.
   Deferred: would change the `persist` signature across all workflows. Draft
   CV instead re-resolves via the same map with identical inputs, so the
   recorded model matches the run with a far smaller blast radius.
3. Make tiers required env. Rejected: unset fast/heavy must fall back to the
   default model so existing single-model deployments behave identically with
   no new env vars.

## Consequences

Positive:

- Cheap tasks can run a cheaper/faster model; Draft CV can opt into a stronger
  one — both by configuration, no code change.
- A single source of truth for the task→tier policy that US-067/068/069 extend.
- Existing deployments are unaffected until the new env vars are set.

Tradeoffs:

- A new workflow defaults to the default tier silently until added to the map;
  this is intentional (safe-by-default) but means tier membership is a
  deliberate edit, not automatic.

## Follow-Up

- US-067: version-keyed AI run reuse (skip model calls when inputs unchanged).
- US-068: job-listing local pre-score + capped opt-in `quick_match` (fast tier).
- US-069: provider switch readiness (`AI_PROVIDER`).
