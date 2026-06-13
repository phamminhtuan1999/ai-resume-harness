---
target: "/matches/:id"
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-06-12T22-10-34Z
slug: apps-web-src-app-app-matches-matchid
---
# Critique: /matches/:id (Job Analysis decision surface)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Refresh flow exemplary (live status, result banner, focus management) — but zero `loading.tsx`/`error.tsx` under `(app)`; tab clicks block silently |
| 2 | Match System / Real World | 3 | Plain-language verdicts strong; "27% match · High risk" is dashboard vocabulary in the qualitative slot |
| 3 | User Control and Freedom | 2 | Inline confirms with Cancel good; running refresh can't be cancelled; credits spent with no pre-disclosure |
| 4 | Consistency and Standards | 2 | Fixed tab order excellent; uppercase labels vs ban, raw `<details>` vs DetailsSection, h1 skips font-display, verdict colors contradict DESIGN.md |
| 5 | Error Prevention | 3 | Material guardrail naming actual missing skills is excellent; paid Refresh has no cost cue — failure surfaces post-hoc |
| 6 | Recognition Rather Than Recall | 3 | Stable six-tab shell rewards spatial memory; emphasis dot unexplained; `/roadmap` lights no tab |
| 7 | Flexibility and Efficiency | 2 | Tabs are real shareable routes; no prev/next match nav, no shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | Calm border-first system; 3 "Update your profile" CTAs + N per-gap links on one screen; box-in-box-in-box nesting |
| 9 | Error Recovery | 3 | Health notices map cause → friendly copy → named recovery; raw API `packageResult.message` can leak (`page.tsx:57`) |
| 10 | Help and Documentation | 2 | Advanced tab self-describes; no explanation of the four verdicts, no legend for the emphasis dot |
| **Total** | | **25/40** | **Acceptable — solid skeleton, honesty-signal gaps** |

## Anti-Patterns Verdict

**LLM assessment:** No (leaning clean). No side-stripes, gradient text, glassmorphism, hero-metric, numbered scaffolding, or card-grid sameness; the one big number (Analysis confidence) is deliberately exiled to Advanced and copy is linted against debug vocabulary in CI. Two violations: uppercase-tracked eyebrow labels at `next-actions-panel.tsx:162,171` ("Also useful", "Advanced actions") against the sentence-case rule, and a decorative emerald Sparkles icon (`decision-recommendation.tsx:23`) against the Earned Emerald Rule.

**Deterministic scan:** 0 findings, exit 0, across `app/(app)/matches` + `components/matches` (detector engine self-test passed; true negative). The detector confirms the absence of the patterns it can match (gradient text, AI palettes); the uppercase-label and decorative-accent findings are judgment calls only the review caught. No false positives.

**Visual overlays:** Not available — Claude-in-Chrome extension not connected (`list_connected_browsers` returned `[]`; verified twice by two independent agents). No overlay was injected; findings are source-derived.

## Overall Impression

The decision-first architecture is genuinely built, not just claimed — verdict leads, evidence supports, mechanics exiled, recovery everywhere. What's missing is the last layer of honesty signals: paid actions don't disclose cost, a green up-arrow can render on a downgrade, and the page's kindest copy is surrounded by amber noise and repeated CTAs. The single biggest opportunity: make the money/credits relationship as honest as the verdict copy.

## What's Working

1. **Decision-first hierarchy enforced in CI** — verdict card → notices → recommendation → evidence/actions; numeric confidence behind Advanced; `DEBUG_TERMS` copy lint. Rare to see a design principle with a test.
2. **Every negative state ships a recovery** — health notices map cause→copy→action; weak-readiness gets an inline warned confirm naming the real missing skills. Systemic, not ad hoc.
3. **Shell discipline** — fixed tab order with dot emphasis instead of reordering, tabs as real routes with `aria-current`, sr-only emphasis label, focus management on async completion.

## Priority Issues

- **[P1] Paid AI actions carry no cost signal**: `refreshAnalysisAction` debits credits but the control is a casual ghost button; price is discovered via a post-hoc red error. **Why:** with billing live this is an honesty gap in an honest-coach product. **Fix:** cost chip on every spend control ("Refresh Analysis · 1 credit") + disable-with-reason when balance is short. **Command:** /impeccable harden
- **[P1] Per-gap affordance ignores `gap_type` and spams the page**: `decision-evidence.tsx:153` renders "I have this — add it to my profile" under every gap including `true_gap`; 4+N near-identical profile CTAs in worst state. **Why:** invites claiming skills the user lacks (Truth-Guard-corrosive) and dilutes the single next step. **Fix:** branch on `gap_type` (true_gap → "See how to close this" → /gaps), dedupe profile CTAs to one canonical placement. **Command:** /impeccable clarify + distill
- **[P2] Green up-trend icon on a downgrade**: `decision-header.tsx:62-69` renders `TrendingUp text-success` regardless of `delta.direction`. **Why:** a visual claim the data contradicts at an emotionally loaded moment. **Fix:** TrendingDown + neutral/risk color for Down. **Command:** /impeccable polish
- **[P2] Verdict color canon drift**: code maps `apply_with_improvements`→info / `learning_target`→warning; DESIGN.md specifies the opposite (and risk for not_recommended vs code's gray). **Why:** amber Learning Target reads as hazard on an aspirational verdict. **Fix:** pick a canon, update the other side. **Command:** /impeccable colorize
- **[P2] Banned label style + native disclosure in actions panel**: uppercase-tracked labels; raw `<summary>` where `DetailsSection` exists. **Fix:** sentence-case 12px labels; reuse DetailsSection. **Command:** /impeccable polish
- **[P2] No loading states across the six-tab shell**: zero `loading.tsx`; skeleton primitive exists unused. **Fix:** route-level skeletons for the `[matchId]` segment. **Command:** /impeccable harden

## Persona Red Flags

**Alex (power user):** refresh cost invisible until clicked; no prev/next match navigation (triaging 20 jobs = bouncing via /matches); silent tab loads; score digits lack `tabular-nums` (Tabular Numbers Rule violation in decision-evidence score rows + analysis-history columns).

**Sam (screen reader/keyboard):** heading outline jumps h1→h3 (CardTitle is a div, so "Why ApplyWise thinks this" is invisible to heading nav); focus loss on both inline confirms (GenerateAnywayAction / LearningTargetAction unmount the focused button; warning never announced); tab links lack the system's 3px focus-ring vocabulary.

**Anxious career-switcher:** gray "Not Recommended Yet" is kind, but: green up-arrow possible on a drop, two stacked amber notices, "No evidence-backed strengths found yet" with no softener, amber Learning Target reads as hazard, N invitations to claim "I have this" for skills they lack. The verdict copy is kind; the surrounding signal system isn't yet.

## Minor Observations

- Empty state says "Regenerate analysis" when nothing was ever generated.
- Button casing inconsistent: "Refresh Analysis" / "View 4-Week Roadmap" vs sentence-case elsewhere.
- h1 (`text-xl`, Geist) skips `font-display` — the flagship surface is the only page without Sora at title level.
- `TableHead` primitive is uppercase vs sentence-case label spec.
- Hardcoded `text-[oklch(...)]` literals repeated in roadmap-entry-card, empty-state, badge — should be a token.
- Evidence fallback hardcodes `importance: "critical"` for snapshot gaps.
- Emphasis dot has no sighted-user explanation.
- Overview gap items don't link to their richer detail on the Gaps tab.

## Questions to Consider

1. If the verdict is the product, why does the job title get the h1 and the verdict only a 20px badge?
2. The engine authors next-actions and the UI renders them all — would "one primary action, everything else behind More" feel more like a coach's advice than a menu?
3. Now that credits are real money: is a post-hoc "insufficient balance" error ever acceptable under Truth Guard?
