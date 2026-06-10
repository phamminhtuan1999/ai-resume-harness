# US-051 Detail Tabs & Advanced Analysis Details

## Status

planned

## Lane

normal

## Product Contract

Detailed analysis content is organized into clear tabs — Overview, Skill
Gaps, Resume Strategy, Application Materials, Interview Prep, Analysis
Details — with emphasis adapting to the decision label. The AI workflow panel
(steps, statuses, models, per-step regenerate) moves out of the main flow
into Advanced Analysis Details (the Analysis Details tab), collapsed by
default, and keeps its debugging value: step name, status, last run time,
provider, model, confidence, error detail, per-step regenerate, and stale
markers for dependent steps.

Covers brief Epics 4 and 6 (user stories 4.1, 4.2, 6.1, 6.2).

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/ai-workflows.md` (workflow panel visibility)
- `docs/stories/period-11/README.md` (restatement #9 — tabs are a navigation
  shell; sub-page internals are not redesigned this period)
- `docs/product/ui-ux-quality.md`

## Acceptance Criteria

- Given the job analysis page loads, then detail content is reachable through
  six tabs in a **fixed, label-independent order**: Overview, Skill Gaps,
  Resume Strategy, Application Materials, Interview Prep, and the debug tab
  displayed as **"Advanced"** (internally the Analysis Details surface;
  renamed because "Analysis Details" invites mainstream users into a debug
  view — restatement #17) — implemented as navigation over the existing
  sub-routes (`/gaps`, `/resume-suggestions` + strategy, `/draft-cv` +
  `/cover-letter`, `/interview-prep`) with Overview as the US-048 surface;
  the roadmap stays reachable via Learning Target actions and Skill Gaps (no
  Roadmap tab).
- Given a roadmap exists for the match, then the Overview shows a persistent
  roadmap entry card ("View 4-Week Roadmap · generated Jun 8") — the
  learning-target persona's primary artifact has a stable home without a
  seventh tab.
- Given I open Overview, then I see decision, recommendation, evidence, and
  next actions (US-048/US-049 content) — no workflow internals.
- Given I open Skill Gaps, then I see missing skills with importance, gap
  type, and how to fix (existing US-029 surface under the tab shell).
- Given I open Resume Strategy, then I see the full strategy contract defined
  in US-049 (supported keywords to emphasize, unsupported keywords not to
  claim, recommended positioning, and whether a Draft CV is recommended) over
  the existing US-031 strategy view — applying whenever the tab is opened, not
  only on the improve-first gate path.
- Given I open Application Materials, then I see Draft CV and Cover Letter
  entries with export readiness status (existing US-039/US-041/US-046
  surfaces) honoring US-049 readiness placement.
- Given I open Interview Prep, then I see the existing interview prep
  surface focused on this job.
- Given I open the Advanced tab, then I see the workflow panel
  (`ai-workflow-panel.tsx`): step name, status, last run, provider, model,
  confidence (the numeric % lives here, not in the header — restatement
  #16), error message when failed, and per-step regenerate where supported —
  plus analysis history (US-054 lands there). The `scores` sub-breakdown
  renders on Overview (US-048), not here.
- Given a step is regenerated from the Advanced tab, then exactly one
  decision recompute follows the step (US-047's exactly-one-recompute rule)
  so the visible label never diverges from the regenerated module outputs.
- Given I open the page, then no workflow panel or step list is expanded on
  the main surface — Analysis Details is collapsed/secondary by default.
- Given a workflow step fails, then the main page shows only a simple
  user-friendly message (copy per US-053) and the technical detail is
  visible inside Analysis Details.
- Given a step is regenerated from Analysis Details, then only that step
  re-runs (existing `/ai-workflow/{step}/regenerate` behavior), and
  dependent steps that become stale show a clear stale status in the panel.
- Given the decision label, then tab emphasis adapts: `strong_apply`
  emphasizes Application Materials + Interview Prep; `apply_with_improvements`
  emphasizes Resume Strategy + Skill Gaps; `learning_target` emphasizes
  Skill Gaps (+ roadmap card); `not_recommended` emphasizes Overview.
  **Emphasis is a visual indicator on fixed tabs only** (accent dot/badge +
  the recommendation card deep-linking into the emphasized tab) — never
  reordering and never hiding: tab positions must be identical across jobs
  and labels (spatial consistency, restatement #17), and the indicator is
  not color-only (icon/badge shape).

## Design Notes

- Commands: none new.
- Queries: package `analysis_details.steps[]` for the panel summary; the
  existing `GET /{match_id}/ai-workflow` remains the panel's full data
  source.
- API: none new; per-step regenerate endpoints unchanged.
- Tables: none.
- Domain rules: stale-dependency marking reuses the workflow panel's
  existing step-dependency knowledge (US-038); tab emphasis mapping comes
  from the decision label via the shared helper.
- UI surfaces: tab shell on `/matches/[matchId]` (likely a layout with tab
  navigation across the existing sub-routes); relocation of
  `ai-workflow-panel.tsx` from the main page into the Analysis Details
  surface; emphasis styling per decision. Sub-page internals untouched
  except for the shared tab shell/breadcrumb (restatement #9; prior product
  direction defers sub-page rework).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-051 --unit 1 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tab set renders all six entries with correct targets in the **same fixed order for every label fixture**; emphasis indicator (non-color-only) per label fixture without reordering; roadmap entry card renders on Overview when a roadmap fixture exists; workflow panel absent from main-surface render; numeric confidence renders here and not in the header; failure copy on main surface is the friendly variant; stale marker rendering. |
| Integration | Page-level render: tab shell + Overview default; Advanced tab contains the workflow panel with fixture runs; per-step regenerate triggers exactly one decision recompute (asserted with US-047's helpers). |
| E2E | Navigate every tab; regenerate one step from Analysis Details and observe only that step re-running. (Browser E2E remains the suite-wide gap.) |
| Platform | Responsive tab behavior on mobile width (existing responsive QA pattern from US-016/US-026). |
| Release | `tsc --noEmit`, `eslint`, `node --test` web suite. |

## Harness Delta

None expected beyond story bookkeeping. The tabs-as-routes vs tabs-in-page
choice is a US-051 implementation decision (not in scope for decision 0015,
which covers the engine/package/tracker contracts); record it in this story's
trace if it materially shapes the surface.

## Evidence

Not started — packet created 2026-06-10.
