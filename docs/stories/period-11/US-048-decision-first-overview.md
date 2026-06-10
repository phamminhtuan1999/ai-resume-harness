# US-048 Decision-First Overview UI

## Status

planned

## Lane

normal

## Product Contract

The top of the job analysis page answers "should I apply, why, and what next"
within seconds. It leads with one decision header (display label + match
score + risk level + confidence), followed by a plain-language assistant
recommendation and a "Why ApplyWise thinks this" evidence section (matched
evidence, missing critical skills, risks, confidence explanation). The
module-output presentation (separate insight card + raw analysis blocks as
the page lead) is replaced. No technical/debug vocabulary appears on the main
surface.

Covers brief Epics 1 and 5 (user stories 1.1, 1.2, 5.1, 5.2). Consumes the
US-047 analysis package; does not call module endpoints for the overview.

## Relevant Product Docs

- `docs/product/overview.md` (job analysis surface)
- `docs/product/ai-workflows.md` (decision engine + package, after US-047)
- `docs/product/ui-ux-quality.md` (copy and state rules)
- `docs/stories/period-11/README.md` (restatements #1, #10, #11)
- `docs/decisions/0015-job-analysis-decision-engine.md` (§1 labels, §5
  package incl. `scores`; OQ#2 — insight card retired)

## Acceptance Criteria

- Given a job has been analyzed, when I open `/matches/[matchId]`, then the
  first content block is the decision header showing exactly one display
  label ("Strong Apply Target", "Apply With Improvements", "Learning
  Target", or "Not Recommended Yet") with overall match score and risk level
  on one line (e.g. "27% match · High risk"). **Confidence is not a second
  percentage in this line** — it renders qualitatively (next AC; restatement
  #16). The header also carries a job-facts line (location/remote, salary
  when captured), the resume the verdict is about (`resume.title` — matches
  are per resume), and the "Last analyzed …" timestamp with the single
  Refresh control beside it (control owned by US-050).
- Given the latest snapshot changed labels (`decision.previous` differs),
  then the header shows the delta in plain language ("Up from Not Recommended
  · Jun 8") linking to history (US-054) — the improvement moment is visible
  on the main surface, not only in the Advanced tab.
- Given the job has a tracker row with status applied/interviewing/offer,
  then the header carries an applied banner ("You applied on {date}") and the
  verdict copy is framed as context, not as advice to shop around (action
  suppression itself is US-049).
- Given the decision header renders, then directly below it the AI
  recommendation card explains, in plain English: whether to apply, why,
  the main matching/missing evidence, and what to do next — sourced from
  the package's `decision.summary` and assistant copy. For `not_recommended`
  the card must always name the concrete path forward ("To make this
  realistic, you'd need evidence of X and Y — start with your profile"),
  never only the verdict.
- Given the package is available, then a "Why ApplyWise thinks this" section
  shows: matched evidence, missing critical skills, and risks, each as short
  human sentences (package `evidence`); a required skill with no evidence is
  shown as missing/unsupported, weak evidence is marked "needs confirmation"
  (per US-029 `evidence_status`); each missing/weak item carries an inline
  "I have this — add it to my profile" link that deep-links to the profile
  editor and prompts a re-check on return (the correction loop for wrong
  evidence).
- Given the package includes confidence reasons, then confidence renders as a
  plain-language line derived from the reason codes ("Based on a complete
  profile and full job description" / "Limited analysis — your profile is
  missing key fields"); the numeric confidence % appears only in Advanced
  Analysis Details (restatement #16). Given `profile_incomplete` or
  `no_target_role` is among the reasons, then the explanation links toward
  updating the profile, and `no_target_role` renders the set-your-target-role
  prompt (decision 0015 §3).
- Given model/debug information exists (provider names, "deterministic
  baseline", workflow step names), then none of it renders in the decision
  header, recommendation, or evidence sections — it remains available only
  inside Advanced Analysis Details (US-051).
- Given the match has not been analyzed yet (`analysis_state:
  not_analyzed`), then the page shows the existing generate-analysis entry
  point instead of an empty decision header.
- Given the analysis is stale (`analysis_state: stale` — including via
  profile edits, decision 0015 §10), then the header shows the "Out of date"
  affordance which triggers the single Refresh control directly (US-050).
- Given the decision label is weak (learning_target / not_recommended), then
  the header region contains no primary Draft CV / Cover Letter affordances
  (full action gating is US-049; this story must not render its own
  hardcoded action shortcuts).
- Given a mobile viewport, then the label and match score are visible without
  scrolling; the header stacks before everything else.

## Design Notes

- Commands: none (read-only UI).
- Queries: server component fetch of `GET /api/matches/{match_id}/analysis-package`
  via the existing API client/data-access pattern used by
  `apps/web/src/app/(app)/matches/[matchId]/page.tsx`.
- API: consumes US-047 contract only.
- Tables: none.
- Domain rules: label→badge variant and label→display copy come from one
  shared helper (no per-component copies); copy rules per restatement #11 —
  brief's example copy is directional.
- UI surfaces: rework the top of `/matches/[matchId]`: retire the US-030
  insight card block (around line ~260) and reposition the score breakdown
  (rendered from the package `scores` field — no module endpoint call) and the
  evidence cards "Why you match" / "What is missing" / "Risks" (around lines
  ~463–496) under the new evidence section. **Do not touch the sidebar action
  block (~407–443)** — that surface is owned by US-049. The US-030 card is
  **retired from the main page** (decision 0015; README OQ#2 closed
  2026-06-10 — retire now); its `assistant_insights` data still feeds the
  decision engine as input. Retain a back-to-jobs affordance at the top (the
  US-053 breadcrumb `Jobs → Job Analysis` serves it). Design-system primitives
  from Period 7 only; light/dark parity.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-048 --unit 1 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Label→display/badge mapping for all four labels; header shows one percentage only (no numeric confidence); qualitative confidence line per reason code (all nine codes); delta line renders when `decision.previous` differs and not when null; applied banner per application-status fixture; resume title and job-facts line render; evidence renderer marks no-evidence vs weak-evidence correctly and each missing/weak item carries the add-to-profile link; not_recommended card names the concrete path; debug-vocabulary lint on rendered copy (no "deterministic", "workflow", provider names); not_analyzed and stale states render the correct affordances. |
| Integration | Page-level render with a fixture package: header, recommendation, evidence sections present in order; no insight-card duplicate; mobile-width render keeps label + score above the fold. |
| E2E | Open an analyzed match → decision header visible above the fold; weak vs strong fixture shows different labels and copy. (Browser E2E remains the suite-wide gap.) |
| Platform | n/a |
| Release | `tsc --noEmit`, `eslint`, `node --test` web suite. |

## Harness Delta

None expected beyond story bookkeeping. If the package contract proves
awkward to render (missing fields, copy gaps), feed that back as US-047
review comments before freezing, and record friction.

## Evidence

Not started — packet created 2026-06-10.
