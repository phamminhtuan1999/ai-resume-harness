# Exec Plan

## Goal

Every new draft CV carries a policy-clamped rendering recommendation with a
visible reason, stored in `draft_cvs.rendering_json` — the contract US-044
(fonts), US-045 (layout/compression), and US-046 (UI) build on.

## Scope

In scope:

- `app/services/export/page_policy.py`: bands, yoe resolution (column →
  span-parse → unknown default), evidence-volume trigger, seniority signal,
  exceptional gate, clamp helper.
- `RenderingRecommendation` on `DraftCvOutput`; prompt section; fallback
  emission; `postprocess` clamp + notes.
- Migration `0019_period10_rendering_json.sql` (+ live apply when DB
  credentials are available, mirroring 0018).
- `insert_draft_cv(rendering_json=…)` + `_DRAFT_CV_SELECT` extension.
- Unit + integration tests (policy matrix, clamp, workflow, fallback, reads).

Out of scope:

- Renderer/export behavior (US-044/045), UI (US-046), backfill.

## Risk Classification

Risk flags: data model (migration on a live table), external systems (prompt +
output-schema change for the Gemini call), public contracts (envelope/read
payload shape), existing behavior (generation path), multi-domain (profiles,
jobs, matches, drafts). Hard gates: data migration; external provider
behavior → **high-risk** lane.

## Work Phases

1. Discovery: re-read `draft_cv_workflow.py`, `draft_cv_logic.py`,
   `supabase_data.py` draft helpers, migration `0018`; confirm `0019` is the
   next free migration number.
2. Design freeze: band table + proxies exactly as `design.md`; `rendering_json`
   shape field-for-field.
3. Validation first: write the policy unit-test matrix from `validation.md`.
4. Implementation: policy module → schema → prompt → fallback → postprocess
   clamp → migration → persistence → select extension.
5. Verification: pytest (new + full suite); apply migration to live DB when
   `SUPABASE_DB_URL` is available; `harness-cli story update` proof booleans.
6. Harness: product docs current; trace with `--intake 42 --story US-043`.

## Stop Conditions

Pause for human confirmation if:

- `rendering_json` cannot be added additively (any lock/rewrite hazard on
  `draft_cvs`).
- Clamping produces obviously wrong recommendations on real profile data
  (band table wrong, not code wrong) — the band table is product behavior.
- The prompt addition pushes real Gemini outputs into repeated schema-retry
  exhaustion (schema/prompt mismatch ⇒ redesign, not looser validation).
