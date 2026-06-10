# Design — US-047 Job Analysis Decision Engine & Unified Analysis Package

Planning-stage design. Field names below are the working contract; the
direction (labels, rule constants, placement table, endpoint names, snapshot
schema) is frozen in `docs/decisions/0015-job-analysis-decision-engine.md`.

## Domain Model

- `DecisionLabel` (enum): `strong_apply | apply_with_improvements |
  learning_target | not_recommended`. Display labels ("Strong Apply Target",
  "Apply With Improvements", "Learning Target", "Not Recommended Yet") are
  presentation copy, mapped in one shared helper (same pattern as tracker
  statuses, decision 0009).
- `DecisionInputs` (value object): overall + sub scores (US-028, integers
  0–100), missing skills with importance/gap_type/evidence_status (US-029),
  insight recommendation/risk/confidence (US-030) when present, the
  **tri-state tailoring signal** (`safe | unsafe | unknown`, from US-031
  strategy / truth-guard outcomes; `unknown` until suggestions exist),
  profile completeness + `user_profiles` timestamps, the job's application
  row (tracker status — drives placement overrides), the user-asserted
  relevance flag (US-052 learning-target save), job extraction status, and
  provider used per module. Module outputs enter through a **per-module
  adapter layer with contract fixtures** owned by this story — module stories
  may not change saved-output shapes without updating the adapters (decision
  0015 Consequences; known drift example: `truth_guard_status` casing).
  **Absent-input defaults are part of the contract** (decision 0015 §2): risk
  defaults to `medium` + `module_missing` reason; `unknown` tailoring never
  blocks a label (only known-`unsafe` does); decision confidence = mean of
  available core-module confidences with one reason per absent module.
- `DecisionRules` (pure module): an **ordered sequence of guarded checks;
  first match wins** (decision 0015 §2 is normative — reproduced here).
  Score-band constants are 80/60/35; "important gap" := `importance =
  'medium'` (`nice_to_have` never affects the label); "critical gap" :=
  critical + `true_gap` + `no_evidence`; boundaries integer-inclusive as
  tested (34/35/59/60/79/80):
  1. **Unsafe-to-claim guard →** `not_recommended`: tailoring known-`unsafe`,
     OR a critical gap exists AND risk is `high`. (Beats score.)
  2. overall < 35 → `not_recommended`.
  3. overall 35–59 → `learning_target` if directionally relevant, else
     `not_recommended` (a critical gap is named in the summary but does not
     change this band's label).
  4. overall ≥ 60 with ≥1 critical gap → `apply_with_improvements`; the
     missing skill is named prominently in the summary and material readiness
     is capped at `allowed_with_warning` (**score wins at 60+** — restatement
     #14).
  5. overall ≥ 80 AND no critical gaps AND no important gaps AND risk ∈
     {low, medium} AND tailoring not known-`unsafe` → `strong_apply`.
  6. overall ≥ 60 (incl. ≥ 80 with important gaps or `high` risk) →
     `apply_with_improvements`; zero-gap firings (high risk alone) must carry
     a risk-based reason, never gap copy (restatement #15).
  No fallback rule — rules 2–4 and 6 partition every score; **reachability of
  every label and clause is a unit-matrix assertion**.
- **Affinity heuristic** (`is_directionally_relevant`, pure): gates
  `learning_target` vs `not_recommended` for weak scores. **The normative
  spec is a role-family fixture matrix** shipped with this story (job title ×
  profile target → expected relevance); the implementation is whatever passes
  it. Signal order (decision 0015 §3): (1) user-asserted relevance — an
  explicit learning-target save (US-052) is always relevant on later
  recomputes; (2) role-family token overlap vs `target_role`, falling back to
  `current_role` (family token sets enumerated in code next to the band
  constants); (3) learnable-gap lean (`wording_gap`/`proof_gap` or adjacent
  to `technical_background`). Both fields empty / no overlap → **not**
  relevant, but never invisibly: emit the `no_target_role` confidence reason
  and the UI renders the set-your-target-role prompt with a profile link.
- `MaterialReadiness` (value object): per artifact (`draft_cv`,
  `cover_letter`): `recommended | allowed_with_warning | not_recommended` +
  reason. Derived from label (+ tailoring + rule 4's cap): `strong_apply` →
  `recommended`; `apply_with_improvements` → `recommended` once
  suggestions/strategy exist (a documented loosening of brief 10.2's
  "reviewed" — no review-state tracking exists), else
  `allowed_with_warning`; rule-4 critical-gap matches stay capped at
  `allowed_with_warning`; `learning_target` / `not_recommended` →
  `allowed_with_warning` (the Generate-Anyway path) per brief Epics 2.2/10.
- `NextAction` (value object): `type`, `label`, `priority`, `reason`,
  `placement` (`primary | secondary | advanced`), `state`
  (`enabled | locked | done` — `locked` carries an inline reason, e.g. the
  Draft CV strategy gate; `done` flips generate-actions to view-actions, e.g.
  "View 4-Week Roadmap" once one exists). The **resolved
  label→action→placement table is normative** (below); the engine emits it
  and US-049 renders and tests against it. Action types route to existing
  surfaces only.
- `ConfidenceExplanation`: score (existing `confidence_score` inputs,
  aggregated per 0015 §2) + reasons from known causes: `profile_incomplete`,
  `no_target_role` (affinity decided the label with no target role set),
  `job_description_short`, `job_not_extracted`, `requirements_ambiguous`
  (low extraction confidence on required skills — brief Epic 5.2),
  `deterministic_fallback`, `module_failed`, `module_output_partial` (a
  module ran but returned incomplete output — brief Epic 5.2),
  `module_missing`. The header renders confidence **qualitatively** from
  these codes; the numeric % surfaces only in the Advanced tab (restatement
  #16).
- `AnalysisPackage` (aggregate/read model): job summary + `resume {id,
  title}` + `application {status, applied_date}` + decision (incl.
  `previous {label, decided_at}`) + `scores` sub-breakdown + evidence +
  skill gaps + next actions + material readiness + assistant copy + analysis
  details + `rules_version`. Assistant copy uses saved insight text when
  fresh, with deterministic fallback sentences — never raw module/debug
  text.

## Resolved Action-Placement Table (normative, frozen in 0015 §4)

Epic 8's example sidebars are the canonical starting point, amended by the
2026-06-10 requirements review with the agency/lifecycle overrides in 0015 §4:

- **Agency actions are never absent**: Open Apply Link (when `job_url`
  exists), Save to Tracker, Save as Learning Target, Generate 4-Week
  Roadmap, and Prepare Interview are emitted for every label — tier varies,
  absence does not.
- **Refresh Analysis is in no tier**: it is the single header utility control
  beside the "Last analyzed …" timestamp (US-048 renders, US-050 owns).
- **Tracker state overrides framing**: when `application.status ∈ {applied,
  interviewing, offer}`, "Review your other saved jobs" and "Keep for
  reference" are suppressed and Prepare Interview is promoted to Primary.
- **`state` flips, geography doesn't**: gated actions render `locked` with an
  inline reason instead of moving tiers; satisfied generate-actions render
  `done` as view-actions ("View 4-Week Roadmap").

| Label | Primary | Secondary | Advanced |
| --- | --- | --- | --- |
| `strong_apply` | Generate Draft CV | Generate Cover Letter, Prepare Interview, Save to Tracker, Open Apply Link, View Skill Gaps | View Analysis Details |
| `apply_with_improvements` | Review Resume Strategy, Generate Resume Suggestions, Generate Draft CV (`locked` — "Review your resume strategy first" — until suggestions/strategy exist) | Review Skill Gaps, Generate Cover Letter, Prepare Interview, Save to Tracker, Open Apply Link | View Analysis Details |
| `learning_target` | Generate 4-Week Roadmap | Save as Learning Target, Update Professional Profile, Prepare Interview, Review your other saved jobs, View Skill Gaps | Generate Materials Anyway, Save to Tracker, Open Apply Link, View Analysis Details |
| `not_recommended` | Review your other saved jobs, Keep for reference | View Skill Gaps, Generate 4-Week Roadmap, Save as Learning Target, Update Professional Profile, Prepare Interview | Generate Materials Anyway, Save to Tracker, Open Apply Link, View Analysis Details |

Action routing and labels: `find_better_matches` is labeled **"Review your
other saved jobs"** (honest until a recommender exists) → `/jobs`;
`save_reference` is labeled **"Keep for reference"** with helper copy naming
the archived status → tracker save with `status='archived'` + note (0015 §4 —
no new status); `save_learning_target` → US-052 (and asserts relevance for
future recomputes, 0015 §3); `generate_roadmap` is offered regardless of the
relevance gate (the gate decides the *label*, not the user's right to a
roadmap) and flips to "View 4-Week Roadmap" when one exists;
`generate_materials_anyway` → the warned/confirmed Draft CV + Cover Letter
path (US-049); `update_profile` → the profile editor (promoted toward Primary
when `profile_incomplete`/`no_target_role` reasons are present);
`view_analysis_details` → US-051's Advanced tab.

## Application Flow

- Query: `get_analysis_package(user_id, match_id)` — a **pure read** (decision
  0015 §7): load saved module rows (no AI calls), serve the **latest
  snapshot's** decision plus composed module data and a computed staleness
  flag. The GET **never writes** — no write-on-read, no view-triggered
  history rows.
- Command: `recompute_decision(user_id, match_id)` — computes via
  `DecisionRules` and persists a new snapshot, recording `previous_label`
  from the latest snapshot and deduplicating via `inputs_hash`
  (compare-before-insert). **Exactly-one-recompute rule:** every flow that
  mutates a decision input ends with exactly one `recompute_decision` — the
  analyze/regenerate endpoints, US-050's refresh (once, at the end of the
  chain), and **each per-step regenerate from Advanced Details** (one
  recompute after the step), so the label never silently diverges from
  regenerated gaps/analysis.
- The package never triggers module generation; absent modules are reported
  as absent (`analysis_state: not_analyzed | partial | complete | stale`).
  Staleness extends the `matches.analyzed_at` rule to **every decision
  input**: resume/job `updated_at` **and `user_profiles.updated_at`**
  (decision 0015 §10) — profile edits must trip the "Out of date" affordance,
  or the product's improvement loop has no trigger.

## Interface Contract

The three Period 11 routes share the `analysis-package` base path (frozen in
decision 0015 §5):

- `GET /api/matches/{match_id}/analysis-package` → 200 envelope:
  `{ version, rules_version, job, resume { id, title }, application
  { status, applied_date } | null, decision { label, display_label,
  match_score, risk_level, confidence, confidence_reasons[], summary,
  previous { label, decided_at } | null }, scores { overall, skill,
  experience, ai_readiness, ats_keywords, seniority }, evidence { matched[],
  missing[], risks[] }, skill_gaps[], next_actions[], material_readiness
  { draft_cv, cover_letter, reason }, analysis_state, analysis_details
  { model_provider, model_name, last_run_at, steps[] } }`. The `scores`
  sub-breakdown (brief Epic 7 view model) is served by the package so the UI
  never calls the match-analysis endpoint for the overview (US-048); fields
  mirror the US-028 score breakdown. `resume` names which resume the verdict
  is about (matches are per `(user, resume, job)`); `application` carries the
  tracker row driving the placement overrides; `decision.previous` lets the
  header render the delta line without opening history. Response is ETaggable
  via the latest snapshot's `inputs_hash`; composition is batched/parallel
  with a bounded query count (≤ 10 PostgREST round trips on the full
  fixture — asserted in validation).
- `POST /api/matches/{match_id}/analysis-package/refresh` — Refresh Analysis
  (defined and owned by US-050; listed here for contract completeness).
- `GET /api/matches/{match_id}/analysis-package/history` — decision snapshots
  newest-first (defined and owned by US-054).
- 404 when the match is absent or not owned (existing ownership pattern in
  `apps/api/app/routers/matches.py`); 200 with `analysis_state:
  "not_analyzed"` and a null decision when no analysis has run yet (the UI
  needs the empty state, not an error).
- Existing module endpoints unchanged.

## Data Model

- New table `analysis_decisions` (working name; migration `00NN` next free
  number at implementation): `id uuid pk`, `user_id` (cascade), `match_id`
  (cascade), `label text` (CHECK in four values), `display_label text`,
  `match_score numeric`, `scores_json jsonb` (the sub-score breakdown, so
  history can show how skill/ai_readiness moved), `risk_level text`,
  `confidence numeric`, `confidence_reasons_json jsonb`, `summary text`,
  `evidence_json jsonb`, `inputs_snapshot_json jsonb` (module row ids +
  timestamps used), `inputs_hash text` (module row ids + their `updated_at`
  + `rules_version` — the compare-before-insert identity preventing
  duplicate snapshots), `rules_version text` (bands are tunable; history must
  distinguish "rules changed" from "you changed"), `previous_label text`,
  `decided_at timestamptz`, timestamps. **Decision facts only** — no
  next-actions/material-readiness blobs (volatile presentation data with no
  history consumer; decision 0015 §7). Append-only; index `(user_id,
  match_id, decided_at desc)`; RLS per user, same pattern as Period 8 tables.
  Cascade delete via user/match is the privacy/GDPR deletion path (snapshot
  evidence text is resume-derived PII). Retention policy: most recent 50
  snapshots per match (enforcement may be deferred; the policy may not).
- No changes to existing tables. `assistant_insights` keeps its enum and
  becomes engine input.

## UI / Platform Impact

None in this story; US-048+ consume the endpoint. The response is designed so
the page renders from this single call (plus existing artifact endpoints when
a tab needs full module detail).

## Observability

- One canonical log line per package request (existing logging contract).
- Snapshot writes are the audit trail for decision changes; an
  `activity_feed` entry (`analysis_decision.changed`) is written only when
  the label changes, so the feed stays meaningful.

## Alternatives Considered

1. Extend `assistant_insights` with the new label — rejected: conflates
   model-influenced output with the deterministic verdict and complicates
   history.
2. Compute-on-read only, no persistence — rejected: Epic 13 (history,
   previous vs. new decision) needs durable snapshots.
3. Frontend composes modules (status quo) — rejected by the brief's
   maintainability NFR; the UI must consume one package.
4. New top-level `/analysis-packages/{id}` resource — rejected: the package
   is match-scoped; nesting under `/matches/{match_id}` matches every other
   module route.
