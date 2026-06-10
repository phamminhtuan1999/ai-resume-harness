# US-049 Recommendation-Based Next Actions & Material Guardrails

## Status

planned

## Lane

normal

(Stronger validation: changes existing user-visible action behavior across
the page and gates material generation; 2–3 risk flags, no hard gate.)

## Product Contract

The static sidebar of equal-weight module links on `/matches/[matchId]` is
replaced by "Recommended Next Actions" driven by the decision label: primary
actions emphasized, secondary below, everything else under Advanced Actions.
Application materials (Draft CV, Cover Letter) are primary only when the
decision allows; for weak decisions they sit behind an explicit, warned
"Generate Anyway" confirmation. Resume strategy is surfaced before a full
draft for improve-first decisions.

Covers brief Epics 2, 8, and 10 (user stories 2.1, 2.2, 8.1, 10.1, 10.2).
Action lists and placements come from the US-047 package (`next_actions`,
`material_readiness`); this story renders and enforces them.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/ai-workflows.md` (material readiness, after US-047)
- `docs/stories/period-11/README.md` (restatements #7, #12)
- `docs/decisions/0012-ai-workflow-standards.md`,
  `docs/decisions/0013-draft-cv-export-architecture.md` (Truth Guard stays
  the unsupported-claims guarantee)
- `docs/decisions/0015-job-analysis-decision-engine.md` (§4 normative
  placement table, Save as Reference → `archived`)

## Acceptance Criteria

The four label action sets below are exactly the **normative placement table**
frozen in US-047 design.md / decision 0015 §4 (as amended 2026-06-10). This
story renders that table; it does not author its own mapping. Refresh Analysis
is in **no tier** — it is the single header utility control (US-048 renders
it, US-050 owns it; restatement #13). Agency actions (Open Apply Link when
`job_url` exists, Save to Tracker, Save as Learning Target, Generate 4-Week
Roadmap, Prepare Interview) are emitted for **every** label — tier varies,
absence does not (restatement #18).

- Given `strong_apply`, then **primary**: Generate Draft CV. **Secondary**:
  Generate Cover Letter, Prepare Interview, Save to Tracker, Open Apply Link,
  View Skill Gaps. **Advanced**: View Analysis Details.
- Given `apply_with_improvements`, then **primary**: Review Resume Strategy,
  Generate Resume Suggestions, and Generate Draft CV rendered **permanently
  in the primary tier but `locked`** with the inline reason "Review your
  resume strategy first" until suggestions/strategy exist — stable geography,
  no tier-teleporting button. **Secondary**: Review Skill Gaps, Generate
  Cover Letter, Prepare Interview, Save to Tracker, Open Apply Link.
  **Advanced**: View Analysis Details.
- Given `learning_target`, then **primary**: Generate 4-Week Roadmap.
  **Secondary**: Save as Learning Target (US-052), Update Professional
  Profile, Prepare Interview, Review your other saved jobs, View Skill Gaps.
  **Advanced**: Generate Materials Anyway, Save to Tracker, Open Apply Link,
  View Analysis Details. Draft CV and Cover Letter are never primary.
- Given `not_recommended`, then **primary**: Review your other saved jobs
  (routes to `/jobs` — labeled honestly until a recommender exists), Keep for
  reference (stores `applications.status = 'archived'` with a note, helper
  copy names the archived status — no new tracker status). **Secondary**:
  View Skill Gaps, Generate 4-Week Roadmap, Save as Learning Target, Update
  Professional Profile, Prepare Interview. **Advanced**: Generate Materials
  Anyway, Save to Tracker, Open Apply Link, View Analysis Details. Draft CV
  and Cover Letter appear only as the Advanced Generate Materials Anyway
  entry. The roadmap and learning-target actions are offered regardless of
  the relevance gate — the gate decides the label, not the user's right to
  adopt the role as a goal; an explicit learning-target save asserts
  relevance for future recomputes (decision 0015 §3).
- Given the job's tracker row is applied/interviewing/offer, then "Review
  your other saved jobs" and "Keep for reference" are suppressed and Prepare
  Interview is promoted to Primary — the page never tells a user with a live
  application to shop around.
- Given a roadmap (or other artifact behind a generate-action) already
  exists, then the action renders in the `done` state as a view-action
  ("View 4-Week Roadmap") — re-clicking never silently regenerates.
- Given `profile_incomplete` or `no_target_role` is among the confidence
  reasons, then Update Professional Profile is promoted toward the top of its
  tier (the engine emits the priority; this story renders it).
- Given any action's placement/state in the package, then the UI renders it
  in that tier and state; it does not hardcode its own mapping, and an
  unknown action type is placed under Advanced (forward compatibility).
- Given a mobile viewport, then primary actions render directly beneath the
  recommendation card (or as a sticky CTA) and secondary/advanced collapse
  behind "More actions" — the answer to "what should I do next" is never
  three screens down.
- Given the decision changes after Refresh Analysis (US-050), then the action
  list re-renders to match the new decision without a manual reload.
- Given the user triggers Draft CV or Cover Letter while
  `material_readiness` is `not_recommended` (or `allowed_with_warning`),
  then a warning explains the risk in plain language **naming the actual
  missing skills from `evidence.missing`** ("Your profile doesn't show
  evidence for RAG or vector databases…") — never vague "several critical
  requirements" copy — and generation proceeds only after one explicit
  confirmation ("Generate Anyway"; single confirm, per resolved README OQ#4).
- Given the user confirms Generate Anyway, then generation calls the existing
  truth-guarded workflows unchanged (no new pipeline), and the resulting
  view surfaces the existing truth-guard/quality notes as a risk summary so
  the user sees what was excluded or weak.
- Given `apply_with_improvements` with no resume suggestions yet, then the
  Draft CV entry routes the user through Resume Strategy/Suggestions first
  (brief 10.2): the strategy view shows supported keywords to emphasize,
  unsupported keywords not to claim, recommended positioning, and whether a
  draft is recommended — sourced from the saved US-031 outputs.
- Given there are no safe resume improvements, then the strategy view
  recommends improving profile/project evidence first and links to Update
  Professional Profile.

## Design Notes

- Commands: none new on the backend; "Generate Anyway" passes the user's
  explicit confirmation to existing generate endpoints (UI-level gate;
  whether a `confirmed` flag is recorded on the run is decided in
  implementation review — if recorded, it is audit metadata, not behavior).
- Queries: package `next_actions[]` (type, label, priority, reason,
  placement) and `material_readiness`.
- API: existing module endpoints unchanged.
- Tables: none.
- Domain rules: action placement is owned by the US-047 engine; the UI must
  render unknown action types safely (forward compatibility) by placing them
  under Advanced Actions.
- UI surfaces: sidebar region of `/matches/[matchId]` (current static links
  at lines ~407–443) becomes the Recommended Next Actions panel
  (primary/secondary/advanced groups); warning + confirm flow on
  `/matches/[matchId]/draft-cv` and `/cover-letter` entry points; strategy
  gate links to the existing `/resume-suggestions` surface. Action targets
  reuse existing routes — no new pages.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-049 --unit 1 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Placement rendering for all four decision fixtures matches the **normative placement table** (US-047 design.md / decision 0015 §4, amended) — primary/secondary/advanced for each label, agency actions present for every label, no Refresh in any tier, Draft CV `locked`-in-primary with inline reason for `apply_with_improvements`, `done`→view-action flip for an existing roadmap; tracker-status overrides (applied/interviewing fixture → shop-around actions suppressed, Prepare Interview primary); warning shown for `not_recommended` and `allowed_with_warning` readiness and **names the actual missing skills from the fixture's `evidence.missing`**; single confirm required before the generate call fires; unknown action type lands in Advanced; apply-link action only when `job_url` exists; Keep for reference maps to `archived` with helper copy; strategy gate shows supported vs unsupported keywords from fixture; mobile-width render keeps primary actions adjacent to the recommendation card. |
| Integration | With a weak-decision fixture package, the sidebar contains no primary Draft CV/Cover Letter; generate-anyway flow reaches the existing endpoint exactly once after confirmation. |
| E2E | Weak vs strong fixture: sidebar contents differ per mapping; generate-anyway warning appears and proceeds on confirm. (Browser E2E remains the suite-wide gap.) |
| Platform | n/a |
| Release | `tsc --noEmit`, `eslint`, `node --test` web suite. |

## Harness Delta

None expected beyond story bookkeeping. If action types need server-side
additions mid-story, route them through US-047's engine rather than UI
hardcoding, and note it in the trace.

## Evidence

Not started — packet created 2026-06-10.
