# Overview — US-047 Job Analysis Decision Engine & Unified Analysis Package

## Status

implemented (backend + migration applied to live DB + unit/integration tests;
browser E2E deferred to US-048)

## Lane

high-risk

## Current Behavior

The frontend stitches the job analysis experience together from independent
module endpoints in `apps/api/app/routers/matches.py`: `/match-analysis`,
`/missing-skills`, `/assistant-insight`, `/resume-suggestions`,
`/tailored-resume`, `/cover-letter`, `/roadmap`, and `/ai-workflow`. Each
module persists its own table (`matches.analysis_*`, `missing_skill_analyses`,
`assistant_insights`, …) and has its own generate/regenerate/get endpoints.

No single component answers "should I apply, why, and what next". The closest
is the assistant insight (US-030), whose `recommendation`
(`apply_now | tailor_resume_first | build_project_first | low_priority`) is
model-influenced, stored per match, and rendered directly as the user-facing
verdict. Nothing computes material readiness, confidence reasons, or a
prioritized action list; nothing records how the verdict changes over time.

## Target Behavior

The backend exposes one composed, user-facing **analysis package** per match:

- `GET /api/matches/{match_id}/analysis-package` returns job summary, decision
  (label, display label, match score, risk level, confidence, summary), the
  `scores` sub-breakdown (overall, skill, experience, ai_readiness,
  ats_keywords, seniority), evidence (matched, missing, risks), skill gaps,
  next actions (typed, prioritized, with reasons), material readiness (draft
  CV / cover letter: recommended | allowed_with_warning | not_recommended,
  with reason), assistant copy, and analysis details (provider, model, last
  run, workflow step summaries). Companion routes: `POST
  .../analysis-package/refresh` (US-050) and `GET .../analysis-package/history`
  (US-054).
- A deterministic, centralized **decision engine** converts saved module
  outputs into the decision label
  (`strong_apply | apply_with_improvements | learning_target |
  not_recommended`) using the Period 11 rules (score bands 80/60/35, critical
  gaps, risk level, resume-tailoring safety). Server code decides; model text
  never changes the label.
- Each recompute persists an append-only **decision snapshot** (with inputs
  used and the previous label) so history (US-054 / brief Epic 13) is
  queryable.
- Confidence reasons are computed from known causes (incomplete profile,
  short/unextracted job description, deterministic-fallback provider, failed
  module runs) and shipped in the package for the UI to render.

## Affected Users

- Job seeker: sees one coherent recommendation instead of stitched modules.
- Developer/power user: keeps module endpoints and workflow data as the
  advanced/debug surface.

## Affected Product Docs

- `docs/product/ai-workflows.md` (new Decision Engine + Analysis Package
  section)
- `docs/product/data-model.md` (new decision-snapshot table)
- `docs/product/overview.md` (job analysis surface description)
- `docs/decisions/0015-job-analysis-decision-engine.md` (accepted Period 11
  direction — labels, rule constants, affinity heuristic, placement table,
  endpoint names, snapshot schema)

## Non-Goals

- Changing module generation pipelines, prompts, or Truth Guard semantics.
- Removing or reshaping existing per-module endpoints (they remain the source
  of record and the advanced surface).
- Frontend rendering (US-048+), refresh orchestration (US-050), tracker
  status changes (US-052).
- A job-similarity/“find better matches” recommender.
