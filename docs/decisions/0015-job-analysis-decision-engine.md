# 0015 Job Analysis Decision Engine & Unified Analysis Package

Date: 2026-06-10

## Status

Accepted as Period 11 direction (inherits `0012-ai-workflow-standards.md`;
refreshes `0009-application-tracker-status-values.md` via US-052). Recorded at
slicing time per Period 9/10 precedent (decisions 0013/0014 existed as accepted
direction before implementation). **Amended 2026-06-10** after a four-persona
requirements review (enterprise architect, lead BA, product designer, end-user
walkthrough); the amendments — rule rewrite with absent-input defaults, agency
overrides on the placement table, refresh as a header utility, snapshot
lifecycle semantics, qualitative header confidence — are folded into the
sections below. Endpoint names, the decision-rule constants, and the snapshot
schema are frozen here; implementation may refine field-level detail but not
the direction without a new decision.

## Context

Periods 8–10 shipped the AI modules (match analysis, missing skills, assistant
insight, resume suggestions, tailored draft, cover letter, roadmap, interview
prep, draft CV + export) and the AI workflow panel. The job analysis page
(`/matches/[matchId]`) renders every module and every action with equal
weight, exposes several regenerate buttons, and shows the technical workflow
panel inline. The Period 11 brief
(`docs/stories/period-11/brief.md`, verbatim user requirement 2026-06-10) asks
to refactor this into a decision-based assistant that answers "should I apply,
why, and what next" — driven by one decision label, recommendation-based
actions, a single Refresh Analysis, advanced details, learning targets, and
decision history.

Several brief details conflict with the system as built (full adversarial
review: `docs/stories/period-11/README.md`, restatements #1–#12, plus the
review-driven amendments below). The load-bearing decisions:

## Decisions

### 1. The decision label is a new server-side decision layer

A deterministic, centralized, unit-testable decision engine computes one label
per match: `strong_apply | apply_with_improvements | learning_target |
not_recommended` (display labels are presentation copy). The existing
`assistant_insights.recommendation` enum (US-030) becomes *input*, not the
user-facing verdict. AI-generated text never changes the label; on
disagreement the server label wins and a quality note records it. Score-band
constants are **80 / 60 / 35** and are frozen here.

### 2. Ordered decision rules (first match wins)

The labels overlap by score alone, so classification is an ordered sequence of
guarded checks; the first satisfied rule wins. Inputs: overall + sub scores
(US-028, integers 0–100), missing skills with importance/gap_type/
evidence_status (US-029), insight risk/confidence (US-030), the tri-state
tailoring signal (below), and the directional-relevance signal (§3).

**Input defaults** — the absent-module case is the *common* case (a fresh
analysis has no resume-suggestions row) and is part of the contract:

- **Tailoring signal** is tri-state `safe | unsafe | unknown`, derived from
  US-031 strategy / truth-guard outcomes; `unknown` until suggestions exist.
  Only known-`unsafe` triggers the unsafe guard or blocks `strong_apply`;
  `unknown` never blocks a label but emits a `module_missing` confidence
  reason.
- **Risk** defaults to `medium` (+ `module_missing` reason) when no insight
  row exists.
- **"Important gaps"** := gaps with `importance = 'medium'`; `nice_to_have`
  gaps never affect the label. **"Critical gap"** below always means
  `importance = 'critical'` AND `gap_type = 'true_gap'` AND
  `evidence_status = 'no_evidence'`.
- **Decision confidence** = arithmetic mean of available core-module
  confidence scores (match analysis, missing skills, insight), one reason
  emitted per absent module.

Rules, in order:

1. **Unsafe-to-claim guard →** `not_recommended`: tailoring is
   known-`unsafe`, OR a critical gap exists AND risk is `high`. (Beats
   score.)
2. overall < 35 → `not_recommended`.
3. overall 35–59 → `learning_target` if directionally relevant, else
   `not_recommended`. (A critical gap does not change this band's label; the
   gap is named in the summary.)
4. overall ≥ 60 with ≥1 critical gap → `apply_with_improvements`, with the
   missing skill named prominently in the summary and material readiness
   capped at `allowed_with_warning`. **Score wins at 60+** — a deliberate
   deviation from the brief's "critical missing → Not Recommended" (README
   restatement #14): name the gap and warn at generation time instead of
   gatekeeping, and the label no longer inverts on directional relevance.
5. overall ≥ 80 AND no critical gaps AND no important gaps AND risk ∈ {low,
   medium} AND tailoring not known-`unsafe` → `strong_apply`.
6. overall ≥ 60 (including ≥ 80 with important gaps or `high` risk) →
   `apply_with_improvements`. When this fires with zero gaps (high risk
   alone), the summary must carry a **risk-based** reason — never gap copy.
   High-risk-alone is deliberately softened from the brief's Not-Recommended
   criteria (README restatement #15).

Rules 2–4 and 6 partition every score and rule 5 carves `strong_apply` out of
≥ 80, so there is no fallback rule; reachability of **every label and every
clause** is asserted in the US-047 unit matrix. Boundary scores
(34/35/59/60/79/80) are integers, inclusive as tested in US-047.

### 3. Directional-relevance (affinity) heuristic

"Directionally relevant" gates `learning_target` vs `not_recommended` for weak
scores. Deterministic and **decidable by contract**: US-047 ships a normative
role-family **fixture matrix** (job title × profile target → expected
relevance) that *is* the spec; the implementation is whatever passes it.
Signals, in order:

1. **User-asserted relevance wins:** a job the user explicitly saved as a
   learning target (US-052) is always directionally relevant on later
   recomputes — the user, not the heuristic, owns their direction.
2. **Role-family overlap:** normalized token/role-family match between the
   job title/role and `user_profiles.target_role`, falling back to
   `current_role` when `target_role` is empty. The role-family token sets
   (seniority-stripped titles grouped into engineering/data/AI/product/etc.
   families) are enumerated in code next to the band constants and covered by
   the fixture matrix.
3. **Learnable-gap check:** dominant gaps that are `wording_gap`/`proof_gap`
   or adjacent to `technical_background` lean relevant; a wholesale domain
   switch leans not relevant.

When both `target_role` and `current_role` are empty or no overlap exists, the
role is treated as **not** relevant (avoid over-promising a learning path) —
but this outcome is never invisible: the engine emits a `no_target_role`
confidence reason and the UI must render "Set your target role so ApplyWise
can tell whether this role is worth learning toward" with a profile link
(US-048/US-053).

### 4. One resolved action-placement table (Epic 2 vs Epic 8 contradiction)

The brief's Epic 2 action lists and Epic 8 sidebar examples disagree on
placement (Refresh Analysis, Save as Learning Target, Generate Materials
Anyway). Resolution: **Epic 8's example sidebars are the canonical starting
point**, amended 2026-06-10 by the requirements review with three
user-agency/lifecycle rules that override both Epics:

- **Agency actions are never absent.** Open Apply Link (when `job_url`
  exists), Save to Tracker, Save as Learning Target, Generate 4-Week Roadmap,
  and Prepare Interview are emitted for **every** label — the tier varies,
  absence does not. The verdict recommends; it never removes the door
  (README restatement #18). A user with a real interview for a "Learning
  Target" role must reach Prepare Interview from the recommended actions.
- **Refresh Analysis lives in neither tier.** It is a single, always-visible
  quiet utility control in the decision header beside the "Last analyzed …"
  timestamp (US-048 renders the header; US-050 owns the control). This
  supersedes the earlier "Advanced everywhere" resolution and deviates from
  brief Epic 3.1's "primary button" — one control, stable location, outside
  the recommendation tiers (README restatement #13).
- **Tracker state overrides the verdict's framing.** When the job's
  application row is `applied | interviewing | offer`: Find Better Matches
  and Save as Reference are suppressed, Prepare Interview is promoted to
  Primary, and the header carries an applied banner — the page must never
  tell a user with a live application to shop around (US-048/US-049).

The frozen table lives in
`docs/stories/period-11/US-047-analysis-package-decision-engine/design.md`;
US-049 renders and tests against it (not against "Epic 2/8"). Two further
placement rules: Generate Draft CV renders in the **primary tier permanently**
for `apply_with_improvements` but **locked with an inline reason** ("Review
your resume strategy first") until suggestions/strategy exist — stable
geography instead of a button that teleports between tiers (the
generated-not-reviewed gate is a documented loosening of brief 10.2's
"reviewed", since no review-state tracking exists). "Save as Reference" (Not
Recommended) stores `applications.status = 'archived'` with a note and is
labeled **"Keep for reference"** with helper copy naming the archived status —
no new tracker status beyond `learning_target`. "Find Better Matches" is
labeled honestly ("Review your other saved jobs") until a recommender exists.

### 5. Unified analysis package as a composition read model

`GET /api/matches/{match_id}/analysis-package` composes saved module rows (no
AI calls) into the brief's Epic 7 view model — including the `scores`
sub-breakdown (skill, experience, ai_readiness, ats_keywords, seniority), not
only the overall match score. Module tables and endpoints remain the source of
record and the advanced/debug surface. Companion read/write routes share the
base path:

- `GET  /api/matches/{match_id}/analysis-package` — composed package.
- `POST /api/matches/{match_id}/analysis-package/refresh` — Refresh Analysis
  (US-050).
- `GET  /api/matches/{match_id}/analysis-package/history` — decision history
  (US-054).

Beyond the brief's view model, the package carries the user's lifecycle
context (requirements review, 2026-06-10): a `resume {id, title}` block
(matches are per resume — the header must say which resume the verdict is
about), an `application {status, applied_date}` block (tracker awareness, §4),
the `decision.previous {label, decided_at}` pair (so the header can show
"Up from Not Recommended · Jun 8" without opening history), a top-level
envelope `version`, and `rules_version`. The response is ETaggable via the
snapshot's `inputs_hash` (§7); composition is read-only with a bounded,
batched query count.

### 6. Refresh Analysis runs core steps only — over a filtered orchestrator

`run_full_orchestrator.py` (US-038) currently runs **seven** steps
(match_analysis, missing_skills, resume_suggestions, cover_letter, roadmap,
interview_prep, assistant_insight). Refresh Analysis must run only the core
chain (match_analysis → missing_skills → assistant_insight → decision
recompute; job-requirement extraction is conditional and lives in the import
flow, not the orchestrator). Therefore US-050 introduces a **step-profile /
filter** on the orchestrator; it does not reuse the full manifest. Downstream
artifacts (resume draft, draft CV, cover letter, roadmap, interview prep)
regenerate only by explicit user action (cost-control NFR). Note: those
downstream artifacts have **no staleness affordance today**; surfacing
post-refresh staleness on them is out of scope for Period 11.

Refresh is **asynchronous**: the endpoint returns 202 and the client follows
the existing run-status polling (US-038 machinery), refetching the package on
completion — three sequential AI workflows do not fit inside one HTTP
request/response. Guards are **server-side**, not UI-only: a running core
chain for the match returns 409 on a second refresh (checked against
`ai_workflow_runs`), and a per-user refresh cooldown/quota is an explicit
cost NFR. On any core-step failure, **no decision snapshot is written and
`analyzed_at` does not update** — the prior package stands and the failure
surfaces as a `module_failed` confidence reason; history never records
decisions derived from mixed-generation inputs.

### 7. Append-only decision snapshots — written only by recompute

`GET /analysis-package` is a **pure read**: it serves the latest snapshot plus
composed module data and a computed staleness flag; it never writes. Snapshots
are written **only** by `recompute_decision`, and every flow that mutates a
decision input ends with **exactly one** recompute — a batch/orchestrated run
recomputes once at the end; a per-step regenerate from Advanced Details
triggers one recompute after the step. The label can therefore never silently
diverge from its inputs, and history never fills with view-triggered rows.

Each `analysis_decisions` row stores decision facts only: label,
`previous_label`, scores, risk, confidence + reasons, summary, evidence,
`inputs_snapshot_json`, an **`inputs_hash`** (module row ids + their
`updated_at` timestamps + `rules_version` — the compare-before-insert identity
that prevents duplicate snapshots), and **`rules_version`** (the band
constants are explicitly tunable; history must be able to say "the rules
changed, not you" — US-054 renders a marker when versions differ between
adjacent snapshots). Next-action and material-readiness blobs are **not
persisted** (volatile presentation data with no history consumer). Append-only
with per-user/match cascade delete (the privacy/GDPR deletion path — evidence
text in snapshots is resume-derived PII and dies with the user/match);
retention policy: keep the most recent 50 snapshots per match (enforcement may
be deferred; the policy may not). An `activity_feed` entry is written only
when the label changes.

### 8. Learning target is an additive tracker status

`applications.status` gains `learning_target` (additive CHECK-constraint
migration; this decision refreshes 0009). Learning targets are excluded from
active-application counts. No other new status; "Save as Reference" reuses
`archived` (decision 4).

### 9. Page rename is copy-only

Page title/breadcrumb say "Job Analysis"; `/matches` route paths are
unchanged. A breadcrumb component does not exist today — US-053 adds one.

### 10. Staleness follows every decision input; one vocabulary everywhere

A decision is stale when **any** input is newer than the snapshot: resume/job
`updated_at` (existing rule) **and `user_profiles.updated_at`** — profile
edits feed the engine (affinity, completeness), and the improvement loop the
product sells ("update your profile, then re-check") must trip the "Out of
date" affordance; the profile editor also prompts "Re-check your saved
analyses?" after a save (US-053). The matches **list** swaps its legacy
`matches.apply_recommendation` badge for the latest decision label + match %
(with a fallback for never-recomputed matches), so list and detail never speak
two vocabularies, and the list supports the 10-second triage promise without
opening each job (US-053).

### 11. The header speaks one number; the payoff moment is visible

The decision header shows the display label + match % + risk. **Confidence
renders qualitatively** from the reason codes ("Limited analysis — your
profile is missing …"); the numeric confidence % lives only in the Advanced
surface — two percentages on one line read as contradiction (README
restatement #16, deviating from Epic 1.1's example copy). When the latest
snapshot changed labels, the header carries the delta ("Up from Not
Recommended · Jun 8") and a completed refresh announces the transition in a
result banner — the most motivating event in the product is not buried in the
debug tab. Tab order is **fixed**; per-label emphasis is visual-only (no
reordering — spatial consistency, README restatement #17); the debug tab's
display name is "Advanced".

## Consequences

- One composition endpoint + decision engine become the contract the whole
  Period 11 UI consumes; the frontend stops stitching modules.
- The US-030 insight card is retired from the main page (its data still feeds
  the engine); the decision header + recommendation absorb it.
- US-050 must add orchestrator step-filtering rather than reuse the full run.
- US-052 migrates the tracker CHECK constraint (high-risk, live-DB apply).
- US-053 adds a breadcrumb primitive, the matches-list decision badges, and
  the post-profile-save re-check prompt.
- The decision engine consumes saved outputs of four-plus workflows through a
  per-module **input-adapter layer with contract fixtures** inside US-047;
  module stories may not change saved-output shapes without updating those
  adapters/fixtures (schema drift already exists in the wild — e.g.
  `truth_guard_status` casing differs between `resume_suggestions` and
  `draft_cvs`).
- US-048/US-049 own the mobile composition (verdict and primary actions
  reachable without scroll) and refresh-time accessibility (live-region
  announcement + focus handling when the label and actions swap in place).
- Decision-rule constants, the affinity heuristic, the placement table, and
  the snapshot schema are testable in one place per the maintainability NFR.

## Alternatives Considered

1. Extend `assistant_insights` with the new label — rejected: conflates
   model-influenced output with the deterministic verdict and complicates
   history.
2. Compute-on-read only, no persistence — rejected: Epic 13 history needs
   durable snapshots.
3. Frontend composes modules (status quo) — rejected by the maintainability
   NFR.
4. Reuse `run_full_orchestrator` unchanged for Refresh — rejected: it would
   regenerate the four downstream artifacts the cost-control NFR forbids.
5. Critical-gap blocks apply labels at any score (the brief's literal rule) —
   rejected for 60+ scores: gatekeeping a high scorer demoralizes (end-user
   review) and inverted on directional relevance as originally ordered; a
   named gap + warned generation preserves both honesty and agency.
6. Write-on-read snapshots ("GET persists when inputs changed") — rejected:
   undefined input identity, double-writes under concurrent reads, and
   view-triggered history rows; recompute is the only writer.
7. Refresh placed inside the action tiers (Advanced everywhere, the first
   resolution of the Epic 3.1 vs Epic 8 contradiction) — superseded: it
   buried the product's core improvement loop behind a collapsed group
   (designer + end-user reviews); a header utility keeps one control and
   makes the loop discoverable.
