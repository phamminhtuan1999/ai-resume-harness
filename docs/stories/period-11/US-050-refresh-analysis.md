# US-050 Refresh Analysis Consolidation

## Status

planned

## Lane

normal

(Stronger validation: new client-visible orchestration endpoint + replaces
existing regenerate controls; 2 risk flags, no hard gate.)

## Product Contract

The main job analysis page exposes exactly one re-run control: **Refresh
Analysis**. It re-runs the core analysis package (profile/job validation,
requirement extraction when stale, match scoring, missing-skill analysis,
assistant recommendation, decision recompute, timestamp update) and never
regenerates downstream artifacts (resume draft, draft CV, cover letter,
roadmap, interview prep). The duplicate regenerate buttons (insight,
analysis, per-step workflow) disappear from the main surface; per-step
regeneration remains available inside Advanced Analysis Details (US-051).

Covers brief Epic 3 (user stories 3.1, 3.2) and the cost-control NFR.

## Relevant Product Docs

- `docs/product/ai-workflows.md` (orchestrator + refresh semantics)
- `docs/stories/period-11/README.md` (restatements #5, #13)
- `docs/decisions/0012-ai-workflow-standards.md` (run records, fallbacks)
- `docs/decisions/0015-job-analysis-decision-engine.md` (§5 refresh route,
  §6 orchestrator step-filter + no downstream staleness)

## Acceptance Criteria

- Given I am on the job analysis page, then I see **exactly one** refresh
  control labeled "Refresh Analysis", rendered as a quiet utility in the
  decision header beside the "Last analyzed …" timestamp — in no action tier
  (decision 0015 §4 as amended; restatement #13) — and no other regenerate
  buttons exist on the main surface. The stale ("Out of date") affordance
  **triggers this control directly**; it is not a second control. Staleness
  includes profile edits (`user_profiles.updated_at`, decision 0015 §10), so
  following the app's own "update your profile" advice surfaces the refresh
  nudge.
- Given I click Refresh Analysis, then the system: validates the active
  candidate profile and saved job description exist (friendly error
  otherwise, per US-053 states); re-runs job requirement extraction only when
  the job changed since the last extraction; re-runs match scoring,
  missing-skill analysis, and the assistant recommendation; recomputes the
  decision and persists a new snapshot (US-047 `recompute_decision`);
  updates `analyzed_at`.
- Given a refresh is running, then the page keeps showing the previous
  package with a progress banner (no skeleton wipe); the control is disabled
  with progress indication.
- Given the refresh completes and the label **changed**, then a result banner
  announces the transition ("Your fit changed: Learning Target → Apply With
  Improvements") with a link to history (US-054); given the label is
  unchanged, the banner confirms "Analysis updated — same recommendation."
  The decision header, evidence, and next actions reflect the new package
  without a manual reload, the stale affordance clears, and the update is
  announced to assistive technology (live region) with focus moved to the
  result banner.
- Given I click Refresh Analysis, then resume drafts, draft CVs, cover
  letters, roadmaps, and interview prep are not regenerated; previously
  generated artifacts remain untouched (row-identity unchanged) rather than
  being silently replaced. (Note: those downstream artifacts have **no
  staleness affordance today**; adding post-refresh staleness markers on them
  is explicitly out of scope for Period 11 — decision 0015 §6.)
- Given a core refresh step fails, then **no decision snapshot is written and
  `analyzed_at` does not update** — the prior package stands (decision 0015
  §6; history never records decisions from mixed-generation inputs); the main
  page shows a friendly message with a retry (full failure-state copy in
  US-053), the run records the failure (`ai_workflow_runs`) and the package
  surfaces a `module_failed` reason; technical detail appears only inside
  Advanced Analysis Details.
- Given refresh is already running for the match, then a second refresh is
  rejected **server-side** (409 against the running core-chain run in
  `ai_workflow_runs`) and the UI control is disabled with progress indication
  (the existing run-status polling) — the guard is not UI-only. A per-user
  refresh cooldown/quota applies as a cost NFR (decision 0015 §6).

## Design Notes

- Commands: `POST /api/matches/{match_id}/analysis-package/refresh` (route
  frozen in decision 0015 §5). **`run_full_orchestrator.py` currently runs
  all seven steps** (match_analysis, missing_skills, resume_suggestions,
  cover_letter, roadmap, interview_prep, assistant_insight — verified in its
  `STEP_MANIFEST`), so it **cannot be reused as-is**: running it would
  regenerate the four downstream artifacts the cost-control NFR forbids.
  US-050 therefore adds a **step-profile / filter** to the orchestrator and
  runs the core chain only: match_analysis → missing_skills →
  assistant_insight → `recompute_decision` (US-047). Job-requirement
  extraction is **not** an orchestrator step — it lives in the import flow and
  is re-run conditionally (only when the job changed) before the chain. The
  included/excluded step lists are explicit in code and tested.
- Queries: refresh is **asynchronous** — the endpoint returns 202 and the
  client follows the existing run-status polling (US-038 machinery),
  refetching the package on completion (decision 0015 §6; three sequential
  AI workflows do not fit one HTTP round trip). A mid-run disconnect leaves
  the run record authoritative; reopening the page resumes polling.
- API: existing `POST /{match_id}/ai-workflow/run-full` and per-step
  regenerate endpoints remain for the advanced surface; the analyze/
  regenerate endpoints stay for compatibility but lose their main-page UI.
- Tables: none new; writes flow through existing run records + the US-047
  snapshot.
- Domain rules: cost control — one user action triggers at most the core
  chain; downstream artifacts regenerate only via their own explicit
  actions.
- UI surfaces: Refresh Analysis button + running state on
  `/matches/[matchId]`; removal of "Regenerate insight" / "Regenerate
  analysis" buttons from the main page.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-050 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Step-selection logic: extraction included only when job changed; excluded-artifact list enforced; failure in one step surfaces typed error and stops per orchestrator rules; result-banner copy for changed vs unchanged label. |
| Integration | Refresh returns 202 + pollable run; completion writes new analysis rows + **one** decision snapshot (end of chain) + updates `analyzed_at`; draft/cover-letter/roadmap/interview rows untouched (row-identity assertion); failed core step → **no snapshot, no `analyzed_at` update**, failed run recorded, friendly envelope; second concurrent refresh → 409 from the server-side guard; profile-edit fixture trips staleness. |
| E2E | Click Refresh Analysis → progress banner → result banner announces the label transition → header/score/actions update; no draft CV regeneration occurs; screen-reader announcement fires (live region). (Browser E2E remains the suite-wide gap.) |
| Platform | n/a |
| Release | API pytest + ruff; web `tsc`, `eslint`, `node --test`. |

## Harness Delta

This story **adds a step-profile / filter to `run_full_orchestrator.py`**
(US-038's module) so the core chain can run without the four downstream
artifacts — a required refactor, not optional (decision 0015 §6). Keep
decision 0012 run-record/fallback semantics. Note the orchestrator change in
the trace.

## Evidence

Not started — packet created 2026-06-10.
