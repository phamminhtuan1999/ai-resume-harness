---
target: "/matches/:id"
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-06-13T06-06-29Z
slug: apps-web-src-app-app-matches-matchid
---
# Critique: /matches/:id (Job Analysis decision surface) — run 3

## Design Health Score: 33/40 (Good) — was 25 → 32 → 33

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Refresh running/polling/result-banner + aria-live; genuinely excellent |
| 2 | Match System / Real World | 4 | Decision-first language; no model jargon (DEBUG_TERMS lint) |
| 3 | User Control and Freedom | 3 | Confirms cancellable; Refresh is one-click = spend, no undo |
| 4 | Consistency and Standards | 2 | Shell breaks: gaps/advanced add their own back-link + icon-rounded-square header the Overview never uses |
| 5 | Error Prevention | 3 | Material guardrail + pre-disable strong; formatVerdictLine can render empty |
| 6 | Recognition Rather Than Recall | 4 | Verdict + line + evidence co-present |
| 7 | Flexibility and Efficiency | 3 | Good disclosure; no keyboard/command surface |
| 8 | Aesthetic and Minimalist | 3 | Header right-rail can stack date+stale+refresh+cost+status lines |
| 9 | Error Recovery | 4 | Every bad state ships a next step |
| 10 | Help and Documentation | 3 | Stale explanation is title-tooltip only (not keyboard/SR-accessible) |

## Anti-Patterns Verdict
LLM: **No (clean)** — every ban passes; hero-metric explicitly inverted (qualitative verdict leads, % behind Advanced). Detector: 0 findings, exit 0 (engine self-test fired). Overlay: unavailable (Chrome can't reach the Clerk-gated app, documented env limit).

## What's Working
1. The verdict-first inversion is real and disciplined — qualitative line leads, the % is genuinely gone from the main surface.
2. Truth Guard reaches micro-decisions — delta icon refuses a green up-arrow on a downgrade; GapActionLink refuses "I have this" on a true gap; warnings name actual skills.
3. Recoverability is total — every empty/error/stale/not-recommended state ships a specific next step.

## Priority Issues
- **[P1] Shell inconsistency Overview vs sub-tabs**: gaps/advanced add their own in-page back-link + icon-rounded-square card header the Overview never uses — two back affordances, two header vocabularies. Fix: drop in-page back-links (breadcrumb covers it), standardize sub-tab headers to plain CardTitle/CardDescription.
- **[P1] Stale explanation is tooltip-only**: the "why out of date" copy lives in the badge title attr — mouse-hover only, invisible to keyboard/SR/touch, against the AAA target. Fix: render as visible muted text or an accessible popover.
- **[P2] formatVerdictLine can render empty**: non-numeric score + unmapped risk → "" → a blank verdict paragraph under the badge. Fix: guard the render / fall back to the label display.
- **[P2] Header right-rail overloads top-of-page**: date+stale+refresh+cost+status lines compete with the verdict. Fix: move refresh machinery to a thin meta-row or the actions rail.
- **[P3] No-change refresh feels flat after a spend**: muted "nothing changed" after a credit spend. Fix: phrase as confirmation of value.

## Persona Red Flags
- **Alex:** no keyboard/command affordance; Advanced actions add a click for the user most likely to want them open.
- **Sam:** stale title attr is keyboard/SR-inaccessible; otherwise focus management on confirms/banner is genuinely well done.
- **Anxious career-switcher:** blunt "Down from Strong Apply Target"; stale badge alarming without its hover-hidden context; GenerateAnyway warning lands hard in the valley.

## Minor Observations
CardTitle wraps h2.contents (verify styling holds); "Risks to weigh" lacks the icon its siblings have; every sub-score bar fills emerald even at 20/100; warning Badge color is a hardcoded OKLCH literal not a token; applied success-chip can sit beside a not_recommended badge.

## Questions to Consider
1. The % is banned from the header but the evidence card still leads with "Overall match XX/100" + five tabular scores 400px down — does the qualitative decision actually hold?
2. Can a user with both a health issue AND an incomplete profile ever see the completeness warning under the single-notice rule?
3. Is narrating every downgrade at the top honest-coach, or anxiety-as-default?
