---
target: "/matches/:id"
total_score: 32
p0_count: 0
p1_count: 2
timestamp: 2026-06-12T23-48-10Z
slug: apps-web-src-app-app-matches-matchid
---
# Critique: /matches/:id (Job Analysis decision surface) — run 2

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Refresh polling + live regions + result banner strong; outcome banner is ephemeral — navigate away and "did my verdict change?" is lost |
| 2 | Match System / Real World | 4 | Plain-language verdicts, "Needs confirmation", no model jargon (DEBUG_TERMS lint-tested) |
| 3 | User Control and Freedom | 3 | Confirms cancellable; running refresh can't be cancelled; disabled refresh removes the affordance when credits are short |
| 4 | Consistency and Standards | 3 | One decision vocabulary list↔detail; but cost chips vanish on the GenerateAnyway confirm button; destructive variant on a non-destructive spend |
| 5 | Error Prevention | 4 | Material guardrail names actual skills; demotion confirms; insufficient credits disable upfront |
| 6 | Recognition Rather Than Recall | 3 | Fixed tab order; emphasis dot still visually unexplained; "Advanced" opaque until clicked |
| 7 | Flexibility and Efficiency | 3 | Real shareable routes per tab; no shortcuts or prev/next-match nav |
| 8 | Aesthetic and Minimalist Design | 3 | Dense and quiet; notices can stack 4+ tinted boxes; "Update your profile" up to 3× |
| 9 | Error Recovery | 4 | Every failure path ships a recovery |
| 10 | Help and Documentation | 2 | Good inline explanation; no tooltip/legend anywhere |
| **Total** | | **32/40** | **Good — solid foundation, address weak areas** (was 25/40) |

## Anti-Patterns Verdict

**LLM assessment: No.** Every ban checks clean; uppercase eyebrows gone (sentence-case labels), no decorative emerald, delta icons can't contradict the data, cost disclosure on controls. "The codebase has the opposite of slop tells — a Linear/Stripe-fluent user would trust this surface."

**Deterministic scan:** 0 findings, exit 0 (engine self-test fired gradient-text + ai-color-palette on a synthetic sample — genuine clean).

**Visual overlays:** unavailable — Chrome extension not connected (verified twice). Rendered-state claims (notice stacking, skeleton shift, contrast) are markup-derived.

## Overall Impression

The verdict-first architecture now extends to the honesty layer: costs disclosed, affordances typed by gap kind, focus management exemplary. The remaining work is composition under stress — the notice pile-up case — and one philosophical leftover: the raw "27% match" still leads the header on a surface whose own design doc says numbers never lead.

## What's Working

1. **Focus management discipline** — both in-place confirms and the result banner move focus with tabIndex/refs and restore on cancel.
2. **Truth Guard reaches the view layer** — GapActionLink can't induce a false claim; delta icons can't contradict data; materialWarning names actual skills.
3. **One decision vocabulary, stable geography** — single decisionMeta source, tabs never reorder, locked actions lock in place, the skeleton mirrors the real layout.

## Priority Issues

- **[P1] Notice pile-up above the verdict**: worst case stacks applied banner + health warning + completeness warning + "Out of date" badge + stale paragraph + result banner — 4+ tinted boxes before the recommendation. **Fix:** single notice slot with priority order (health > completeness > stale), merge stale badge+paragraph, demote applied banner to a header chip. **Command:** /impeccable distill
- **[P1] "27% match" leads the header**: formatVerdictLine puts the raw number under the h1 — tension with US-048/DESIGN.md and the worst first line for the anxious persona. **Fix:** qualitative phrasing in the header from score bands; number stays in Score breakdown. **Command:** /impeccable clarify
- **[P2] Cost disclosure dropped at the commit point**: GenerateAnyway's confirm button omits the credit chip; destructive variant on a cautionary action. **Fix:** "Generate anyway · 2 credits", warning-styled button. **Command:** /impeccable polish
- **[P2] Emphasis dot unexplained for sighted users**: sr-only text only. **Fix:** title attr / micro-label. **Command:** /impeccable polish
- **[P3] not_recommended emphasizes the Overview tab** — points users at the tab they're on; emphasize gaps instead. **Command:** /impeccable polish

## Persona Red Flags

**Alex:** external apply link has no external-link indicator; no prev/next-match nav; must babysit the page for the refresh outcome.

**Sam:** strongest persona story now (focus moves, live regions, aria-current, h1→h2→h3) — but the insufficient-credits explanation isn't programmatically associated with the disabled control; Progress bars lack accessible names; un-analyzed/error empty states likely render no h1.

**Anxious career-switcher:** verdict copy, gray badge, named path forward are right. "27% match · High risk" is still the first thing parsed; bare "Down from Strong Apply Target" is cold; incomplete profile still yields repeated "Update your profile" nagging.

## Minor Observations

Two adjacent card titles both lead with "ApplyWise" (one is voice, two is mechanical); CostChip opacity-75 on emerald fill may miss the AAA target; skeleton shows 4 score tiles vs the real 5 (one-tile shift); path-forward callout is an emerald tint on a not-recommended verdict (borderline Earned Emerald); six brand-colored progress bars render the same emerald at 27 as at 92.

## Questions to Consider

1. "Not Recommended Yet" (badge) + recommendation summary + "Your path forward" are one thought split across three cards — would a single composed verdict block be stronger?
2. When progress is this low, is the brand fill in the score bars still meaning anything?
3. The refresh outcome banner is the best emotional beat and it evaporates on navigation — should verdict changes persist (matches-list delta, notification)?
