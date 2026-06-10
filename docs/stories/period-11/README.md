# Period 11 — Decision-Based Job Analysis Experience

## Goal

Periods 8–10 shipped the AI modules: match analysis, missing skills, assistant
insight, resume suggestions, tailored draft, cover letter, roadmap, interview
prep, draft CV + export, and the AI workflow panel. The result is a
module-output dashboard: `/matches/[matchId]` shows every module and every
action with equal weight, plus several regenerate buttons and a technical
workflow panel.

Period 11 refactors that page into a decision-based AI assistant experience.
The page must answer three questions within seconds:

1. Should I apply?
2. Why?
3. What should I do next?

One server-computed decision label (`strong_apply | apply_with_improvements |
learning_target | not_recommended`) drives the header, the assistant summary,
the evidence section, the recommended next actions, material-generation
guardrails, and tab emphasis. AI workflow internals move behind Advanced
Analysis Details. The many regenerate buttons collapse into one Refresh
Analysis action.

Source brief: `docs/stories/period-11/brief.md` (verbatim user requirement,
2026-06-10, also at repo root
`applywise_job_analysis_flow_refactor_user_stories.md`).

## Status (2026-06-10)

**Planned — story packets only. No implementation has started.**

All eight stories are registered in the durable matrix as `planned`. The
direction is recorded in `docs/decisions/0015-job-analysis-decision-engine.md`
(accepted at slicing, per Period 9/10 precedent): decision-label vocabulary,
ordered decision rules + score constants, the affinity heuristic, the
resolved action-placement table, the three analysis-package routes, and the
snapshot schema are frozen there. US-047 refreshes the durable decision row at
implementation start.

## Current State (what this period refactors)

- `apps/web/src/app/(app)/matches/[matchId]/page.tsx` (~520 lines) renders, in
  order: an "AI job assistant" insight card (US-030), the match analysis with
  score breakdown, an "Analysis basis" card, evidence cards ("Why you match",
  "What is missing", "Resume wording gaps", "Risks"), a static sidebar of
  links to `/gaps`, `/resume-suggestions`, `/resume-draft`, `/draft-cv`,
  `/cover-letter`, `/interview-prep`, `/roadmap`, plus the AI workflow panel
  (`apps/web/src/components/ai-workflow-panel.tsx`, US-038) with per-step
  regenerate. The page also carries two "Regenerate analysis" buttons today
  (the stale affordance and the "Analysis basis" card) that US-050 collapses
  into one Refresh Analysis control.
- `apps/api/app/routers/matches.py` exposes per-module endpoints
  (`/analyze`, `/missing-skills`, `/assistant-insight`, `/resume-suggestions`,
  `/tailored-resume`, `/cover-letter`, `/roadmap`, `/match-analysis`,
  `/ai-workflow`, `/ai-workflow/run-full`, `/ai-workflow/{step}/regenerate`),
  each with its own generate/regenerate/get triple. The frontend stitches the
  outputs together.
- `apps/api/app/services/ai/run_full_orchestrator.py` (US-038) runs the
  **full seven-step chain** (`STEP_MANIFEST`: match_analysis, missing_skills,
  resume_suggestions, cover_letter, roadmap, interview_prep, assistant_insight)
  — not just the core steps, so US-050 must filter it (see restatement #5);
  `assistant_insights.recommendation` already stores
  `apply_now | tailor_resume_first | build_project_first | low_priority` with
  `risk_level` and `confidence_score` (US-030, migration `0013`).
- `applications.status` allows `saved | applied | interviewing | offer |
  rejected | archived` (decision `0009`); there is no learning-target concept.
- `ai_workflow_runs` (US-027, migration `0010`) records every run with
  provider, model, confidence, timestamps, and output snapshots.

The building blocks exist. What is missing is the decision layer that composes
them into one answer, and a UI organized around that answer.

## Adversarial Review — Brief vs. System (restatements)

The brief is input material, not the contract. Deviations below are
deliberate; each story packet carries the detail.

| # | Brief says | System reality | Restatement |
| --- | --- | --- | --- |
| 1 | New decision labels (Strong Apply Target, Apply With Improvements, Learning Target, Not Recommended) | `assistant_insights.recommendation` already stores `apply_now \| tailor_resume_first \| build_project_first \| low_priority` (US-030) and is user-visible today | The decision label is a **new decision-layer output** computed server-side (US-047). Existing insight output becomes an *input* to the decision engine, not the user-facing label. Storage values: `strong_apply \| apply_with_improvements \| learning_target \| not_recommended`; display labels are presentation copy. No destructive migration of `assistant_insights`. |
| 2 | Decision rules keyed on score bands (≥80, 60–79, 35–59, <35) plus gaps/risk/safety | Periods 8–10 standard (decisions 0012/0014): protocol guarantees are **server code, not prompt hopes**; the model contributes copy, the server decides | The decision engine is a deterministic, centralized, unit-testable rules module (same clamp pattern as US-043's page policy). AI-generated text never changes the label; if model copy disagrees with the computed label, the server label wins and a quality note records the disagreement. Band boundaries (35/60/80) are config constants frozen in US-047 and tunable later. |
| 3 | "Backend provides one unified analysis package" (Epic 7 view model) | Module outputs live in separate tables (`matches`, `missing_skill_analyses`, `assistant_insights`, `resume_suggestions`, `cover_letters`, `draft_cvs`, `ai_workflow_runs`, …), each with its own GET | One **composition endpoint** `GET /api/matches/{match_id}/analysis-package` (US-047) reads saved rows and returns the brief's view model (normalized) — **including the `scores` sub-breakdown** (skill, experience, ai_readiness, ats_keywords, seniority), so the UI never calls the match-analysis endpoint for the overview. Module tables and endpoints remain the source of record and the advanced/debug surface; the package is a read model, not a data rewrite. The brief's JSON is a suggestion — final field names are fixed in US-047 design / decision 0015 §5. |
| 4 | Epic 13: track decision history, previous vs. new decision | Nothing persists a composed decision today; `ai_workflow_runs` persists per-module runs | The decision snapshot is **persisted append-only** per refresh (new table, migration in US-047), recording label, scores, risk, confidence, inputs used, and previous label. History UI (US-054) reads it inside Advanced Analysis Details. |
| 5 | One "Refresh Analysis" action re-runs profile validation, job extraction, scoring, gaps, recommendation | `POST /{match_id}/ai-workflow/run-full` (US-038) orchestrates **all seven** steps including the four downstream artifacts; per-step regenerate endpoints exist | Refresh Analysis (US-050) **cannot reuse the orchestrator as-is** (it would regenerate the artifacts the cost-control NFR forbids); US-050 adds a **step-profile filter** and runs core steps only (requirements extraction when the job changed → match analysis → missing skills → insight → decision recompute). It must never regenerate downstream artifacts (resume draft, draft CV, cover letter, roadmap, interview prep). Per-step regenerate endpoints stay, but their UI moves into Advanced Analysis Details. (Those downstream artifacts have no staleness affordance today; adding one is out of scope — decision 0015 §6.) |
| 6 | Epic 9: "Save as Learning Target … stored in my tracker with status learning_target" | `applications.status` CHECK constraint allows six values (decision 0009); dashboard/tracker counts treat rows as application pipeline state | Additive status value `learning_target` (migration + decision-0009 refresh, US-052 — data-model hard gate). Learning targets are excluded from active-application counts and pipeline views by definition, get their own tracker filter/label, and do not break the existing unique `(user_id, job_id)` tracker row rule. |
| 7 | Epic 10: weak-match "Generate Anyway" produces a "constrained draft that excludes unsupported claims" | Truth Guard already guarantees no unsupported claims on every draft path (US-031/US-039, decisions 0012/0013) — that is not a new generation mode | The guardrail is a **readiness gate + warning + explicit confirmation**, not a new pipeline: material readiness comes from the decision engine (US-047), the warning and confirm flow are UI (US-049), and generation reuses the existing truth-guarded workflows unchanged. The weak-match draft additionally surfaces the existing risk/quality notes as a risk summary. |
| 8 | Epic 11: "Rename Matches Page to Job Analysis" | Routes are `/matches` and `/matches/[matchId]`; deep links, redirects, and the tracker's `match_id` linkage depend on them | Rename is **copy-only** (page titles, breadcrumb, nav label) in US-053. Route paths stay. A route rename would be a separate change request with redirect handling; the brief does not require it. |
| 9 | Epic 6: six detail tabs (Overview, Skill Gaps, Resume Strategy, Application Materials, Interview Prep, Analysis Details) | Sub-pages already exist as routes (`/gaps`, `/resume-suggestions`, `/resume-draft`, `/draft-cv`, `/cover-letter`, `/interview-prep`, `/roadmap`); product direction defers deep rework of the AI sub-page internals until their features are refactored | Tabs (US-051) are a **navigation shell** over the detail page and existing sub-routes; sub-page internals are not redesigned this period beyond what the tab/emphasis contract needs. Roadmap has no tab of its own — it is reached through Learning Target actions and Skill Gaps. |
| 10 | Confidence explanations ("profile incomplete", "JD too short", "deterministic baseline only") | `confidence_score` exists per workflow run and per insight; nothing computes user-facing reasons | Confidence **reasons are computed server-side** in US-047 from known causes: profile completeness check, job description length/extraction status, provider = deterministic fallback, module failures. The UI (US-048/US-053) renders reasons, never raw provider/debug text on the main surface. |
| 11 | Brief's UI copy examples ("Not Recommended Yet", "27% match · High risk · Confidence 60%") | Copy quality rules live in `docs/product/ui-ux-quality.md`; current page leaks technical text (e.g. "Generated by deterministic baseline analyzer.") | Copy in the brief is directional, not final. US-048 fixes the copy contract: plain-language assistant voice, no module/debug vocabulary on the main page; technical provenance only inside Advanced Analysis Details. |
| 12 | "Find Similar Easier Roles" / "Find Better Matches" actions | No job-search/similar-roles capability exists in the product | These actions route to the existing jobs list (`/jobs`) and add-job flows. A real "similar roles" recommender is **out of scope** this period and is recorded as a candidate future initiative, not silently promised by a button. |
| 13 | Action placement: Epic 3.1 says Refresh Analysis is "one **primary** button"; Epic 8 sidebar examples place it under **Advanced**; Epic 2 vs Epic 8 also disagree on Save-as-Learning-Target and Generate-Materials-Anyway placement | The brief contradicts itself across Epics 2/3/8 | One **resolved, normative placement table** lives in US-047 design.md (frozen in decision 0015 §4, amended 2026-06-10): Epic 8's sidebars are the starting point, overridden by three agency/lifecycle rules. **Refresh Analysis is in no tier** — it is a single always-visible header utility beside the "Last analyzed …" timestamp (the first "Advanced everywhere" resolution buried the product's improvement loop; superseded). Generate Materials Anyway is Advanced; "Save as Reference" is labeled "Keep for reference" and reuses `applications.status='archived'` + note — no new tracker status. US-049/US-050 render and test the table, not "Epic 2/8". |
| 14 | Decision rules: "Not Recommended — use when critical required skills are missing" | Gatekeeping a 60+ scorer demoralizes and, as first ordered, the label *inverted* on directional relevance (the dream-job candidate got the harsher verdict) | **Score wins at 60+** (decision 0015 §2 rule 4): a critical no-evidence gap at overall ≥ 60 yields `apply_with_improvements` with the missing skill named prominently and materials capped at `allowed_with_warning` — warned generation instead of a blocked label. Below 60 the brief's intent holds (learning_target if relevant, else not_recommended). |
| 15 | Decision rules: "Not Recommended — use when … risk level is high" | A clean high-score role with high risk but zero gaps would get "address some gaps first" copy with no gaps to show | High risk **alone** no longer forces `not_recommended`: it blocks `strong_apply` and lands in `apply_with_improvements` with a **risk-based** reason string (never gap copy). High risk *plus* a critical gap still hits the rule-1 guard → `not_recommended`. (Decision 0015 §2 rules 1/5/6.) |
| 16 | Epic 1.1 UI guidance: header line "27% match · High risk · Confidence 60%" | Two percentages on one line read as contradiction ("am I 27% or 60%?"); confidence is the system grading its own homework — expert vocabulary | The header shows label + match % + risk; **confidence renders qualitatively** from the reason codes ("Limited analysis — your profile is missing …"); the numeric % lives only in the Advanced tab. (Decision 0015 §11.) |
| 17 | Epic 6 names an "Analysis Details" tab; Epic 6.2 "emphasized" read as reordering | "Analysis Details" invites mainstream users into a debug surface; per-label tab reordering breaks spatial memory across jobs | The debug tab's display name is **"Advanced"**; tab order is **fixed** for every label and emphasis is a visual indicator only (accent + recommendation-card deep link), never reordering, never hiding. (Decision 0015 §11.) |
| 18 | The brief specifies actions only per-verdict and says nothing about the user's life around the verdict | Real usage: an interview scheduled for a "Learning Target" role, a tracker row that says `applied`, a profile updated after the analysis ran, five jobs to triage from the list | **Agency & lifecycle additions beyond the brief** (decision 0015 §§4–5, 10–11): agency actions (Open Apply Link, Save to Tracker, Save as Learning Target, Generate Roadmap, Prepare Interview) are emitted for every label; tracker status `applied/interviewing/offer` suppresses shop-around actions, promotes Prepare Interview, and banners the header; staleness includes `user_profiles.updated_at` + a post-profile-save re-check prompt; the package carries `resume`, `application`, and `decision.previous` so the header can name the resume, acknowledge the application, and show the "Up from Not Recommended" delta; the matches list swaps its legacy badge for the decision label (one vocabulary); each missing-evidence item links "I have this — add it to my profile". These are flagged as additions, not silent scope creep. |

## Feature → Story Map

| Brief area | Story | Title | Lane |
| --- | --- | --- | --- |
| Epic 7 + decision rules/labels + material readiness + confidence reasons + decision storage (supports Epic 13) | US-047 | Job Analysis Decision Engine & Unified Analysis Package | high-risk |
| Epics 1, 5 (stories 1.1, 1.2, 5.1, 5.2) | US-048 | Decision-first overview UI (header, recommendation, evidence) | normal |
| Epics 2, 8, 10 (stories 2.1, 2.2, 8.1, 10.1, 10.2) | US-049 | Recommendation-based next actions & material guardrails | normal |
| Epic 3 (stories 3.1, 3.2) + cost-control NFR | US-050 | Refresh Analysis consolidation | normal |
| Epics 4, 6 (stories 4.1, 4.2, 6.1, 6.2) | US-051 | Detail tabs & Advanced Analysis Details | normal |
| Epic 9 (story 9.1) | US-052 | Learning Target tracker flow | high-risk |
| Epics 11, 12 (stories 11.1, 12.1, 12.2) | US-053 | Page naming, empty/error states & profile completeness | normal |
| Epic 13 (story 13.1) | US-054 | Analysis decision history view | normal |

Lanes per `docs/FEATURE_INTAKE.md`: US-047 hits the data-model hard gate (new
decision-snapshot table) plus public contracts (new API shape), existing
behavior, multi-domain, and weak proof on the composition layer. US-052 hits
the data-model hard gate (tracker status CHECK-constraint migration) plus
existing tracker behavior (US-012) and public contracts. The remaining six are
all `normal` (no story honestly reaches the 4-flag high-risk threshold), but
the four that touch implemented, test-covered surfaces warrant **stronger
validation**: US-048 (replaces the US-030 verdict surface), US-049 (gates
material generation + client-visible action behavior), US-050 (new public
endpoint + provider chain + existing behavior — ~3 flags), and US-051
(relocates the US-038 workflow panel). US-053 and US-054 are lighter
UI/read-model work over contracts the other stories establish. Record intake
rows with these flag counts.

Contract-ownership rule (decision 0015 Consequences): the decision engine
reads module outputs through US-047's per-module adapter layer with contract
fixtures — module stories may not change saved-output shapes without updating
those adapters/fixtures.

## Sequencing

```text
US-047 (decision engine + analysis package + storage)
  -> US-048 (decision header, recommendation, evidence UI)
  -> US-049 (next actions + material readiness guardrails)
  -> US-050 (refresh analysis; depends on package recompute)
  -> US-051 (tabs + advanced details relocation)
  -> US-052 (learning target status + save action; needs US-049's actions)
  -> US-053 (naming, empty/error states, profile completeness surfaces)
  -> US-054 (decision history view; needs US-047 storage + US-051 surface)
```

US-047 is the strict prerequisite for everything else. US-048/US-049/US-050
should land in order (the page is rebuilt around the package, then actions,
then refresh). US-051–US-054 are sequenced for review size, not hard
dependency — US-052 can start any time after US-049; US-054 needs both US-047
(data) and US-051 (surface).

## Validation Shape

- **US-047:** pure-function unit tests for the decision rules matrix
  (boundary scores 34/35/59/60/79/80, critical-gap and risk overrides,
  label↔action mapping, material readiness per label, confidence reasons);
  integration tests for `GET /analysis-package` composition (full data,
  partial modules, no analysis yet, ownership denial, decision snapshot
  persisted with previous-label linkage).
- **UI stories (US-048/049/051/053/054):** component/unit tests for
  label→presentation mapping, action visibility per decision, warning flows,
  tab emphasis, empty/error states; `tsc --noEmit`, `eslint`, `node --test`
  suites as in Periods 8–10.
- **US-050:** integration proof that refresh re-runs only core steps (no
  draft/cover-letter/roadmap/interview-prep regeneration), updates the
  decision snapshot and timestamp.
- **US-052:** migration applied to the live Supabase DB via `psql` +
  `SUPABASE_DB_URL` (per the established flow), CHECK constraint verified,
  tracker counts exclude learning targets, REST-reachable.
- Browser E2E remains the tracked suite-wide gap, consistent with Periods
  8–10.

## Out of Scope (this period)

- Any change to the AI generation pipelines, prompts, Truth Guard semantics,
  or draft CV rendering (Periods 8–10 contracts unchanged).
- Route renames (`/matches` stays; copy only).
- A "similar roles" / job recommendation engine (buttons route to existing
  jobs surfaces).
- Deep redesign of the AI sub-pages (`/gaps`, `/resume-suggestions`,
  `/resume-draft`, `/draft-cv`, `/cover-letter`, `/interview-prep`,
  `/roadmap`) beyond tab navigation and entry-point copy.
- Removing the per-module endpoints or per-step regenerate API (they move to
  the advanced surface, not away).
- Notifications, scheduling, or background re-analysis.

## Open Questions (flagged to product owner, non-blocking for packet review)

1. **Threshold ownership.** The brief's bands (80/60/35) are frozen as server
   constants in US-047. Confirm the bands before implementation or accept
   tuning them after seeing real decision distributions.
2. **Insight card fate. (Resolved 2026-06-10 — retire now.)** US-048 retires
   the US-030 insight card from the main page; the decision header +
   recommendation absorb it, and `assistant_insights` data keeps feeding the
   decision engine as input. Recorded in decision 0015.
3. **Learning targets and tracker analytics.** US-052 excludes
   `learning_target` from active-application counts. Confirm whether the
   dashboard should show a separate learning-target count tile or leave them
   visible only in the tracker filter.
4. **"Generate Anyway" friction level. (Resolved 2026-06-10 — single
   confirm.)** One warning naming the actual missing skills + one explicit
   confirmation (end-user review: fair friction; more would punish a choice
   the user is entitled to make). US-049 carries the AC.

## Exit Criteria

Period 11 is complete when, for an analyzed match: the page leads with one
decision label + score/risk/confidence and a plain-language assistant
recommendation; "Why ApplyWise thinks this" shows matched/missing/risk
evidence with qualitative confidence reasons; the sidebar shows
recommendation-based primary/secondary/advanced actions with agency actions
present for every label and tracker-aware framing (a job with a live
application is never told to shop around); generating materials against a
weak decision requires one explicit, warned confirmation naming the actual
missing skills and produces truth-guarded output with a risk summary; one
Refresh Analysis header control (with staleness tripped by resume, job, *and
profile* changes) asynchronously re-runs only the core package, records
exactly one decision snapshot, and announces label transitions in a result
banner, with history (incl. rules-version markers) visible in the Advanced
tab; the AI workflow panel lives collapsed inside the Advanced tab with
per-step regenerate intact and each regenerate followed by exactly one
decision recompute; weak-but-relevant roles can be saved as `learning_target`
(asserting relevance for future recomputes) and are excluded from
active-application counts; page naming/breadcrumbs say Job Analysis and the
matches list shows decision badges in the same vocabulary as the detail page;
incomplete-profile and failure states show friendly copy with recovery
actions; all eight stories are `implemented` in the durable matrix with unit
+ integration proof.
