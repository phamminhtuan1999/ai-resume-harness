---
target: /pricing
total_score: 36
p0_count: 0
p1_count: 1
timestamp: 2026-06-13T06-06-29Z
slug: apps-web-src-app-pricing-page-tsx
---
# Critique: /pricing + /billing/success — run 3

## Design Health Score: 36/40 (Excellent) — was 14 → 28 → 36

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | 4 success states + auto-refresh + "Opening Stripe checkout…" |
| 2 | Match System / Real World | 4 | "a credit is one unit of paid AI work"; outcomes in jobs |
| 3 | User Control and Freedom | 4 | Cancel→/pricing, dismiss links, pending escape-hatch |
| 4 | Consistency and Standards | 3 | SSR ships Buy buttons disabled (opacity-50) until Clerk hydrates |
| 5 | Error Prevention | 4 | "Sign in to buy"; not_found kills the false "finalizing"; card-not-charged copy |
| 6 | Recognition Rather Than Recall | 3 | Pack→cost-table mapping still spans two cards |
| 7 | Flexibility and Efficiency | 3 | Recommended default aids novices; no volume signal |
| 8 | Aesthetic and Minimalist | 4 | Dense, border-first, one accent, restrained brand-radial |
| 9 | Error Recovery | 4 | Every failure names the recovery |
| 10 | Help and Documentation | 3 | FAQ admits cost drift without a changelog/timestamp |

## Anti-Patterns Verdict
LLM: **No (leaning-no)** — packs-as-rows-in-one-card escapes the three-equal-card reflex; credit→outcome translation is honest-coach voice; recommended pack uses a sanctioned brand ring, not a side-stripe. Detector: 0 findings, exit 0. Live: fake/garbage/empty session_id all verified to resolve to not_found ("We couldn't find this checkout"), NOT "finalizing".

## What's Working
1. The 4-state success page is exemplary — never claims more than the Stripe session proves; not_found copy clear and recoverable (verified live across 3 bad ids).
2. Credit→outcome translation does the user's math in plain language — the anti-slop differentiator.
3. Packs-as-rows escapes the category reflex; recommended pack reads behavioral, not "BEST VALUE" hype.

## Priority Issues
- **[P1] Dead-looking primary CTA on first paint**: SSR ships all three Buy buttons disabled at opacity-50 until Clerk hydrates — the page's single primary action looks inert at the buy moment. Fix: render enabled during SSR (server action safely bounces unauth to sign-in) OR show a loading/skeleton state, not a fully-greyed disabled control. (Tension with the run-2 "appear-then-revoke flicker" fix — a deliberate tradeoff to resolve.)
- **[P2] Recommended badge skirts the upsell line**: "Where most searches start" is honest in wording, upsell in placement (mid-tier). Fix: back the claim with evidence ("most multi-week searches spend ~60 credits") or make it need-based copy.
- **[P2] Credit→cost reconciliation spans two cards**: a skeptic re-deriving "6 jobs full prep" hops pack card → cost table. Fix: inline a micro-breakdown on the recommended pack.
- **[P3] Free card placement**: md:order-first returns Free to the left column on desktop, re-creating a faint two-tier read. Fix: confirm intent.
- **[P3] "Will action costs change?" admits drift without a reference**: timestamp the table or link a changes page.

## Persona Red Flags
- **Jordan:** greyed disabled Buy on cold load reads as "broken"; recommended badge's upsell placement could erode trust.
- **Casey:** best-served (packs DOM-first); recommended row slightly cramped at 320px but wraps, no overflow.
- **Riley:** signed-out → "Sign in to buy" (correct); double-click guarded; back-from-Stripe clean; fake session_id → not_found (verified). Only residue: the cosmetic disabled-button paint.

## Minor Observations
Sora pack names test the Sora Ceiling but are defensible on a brand-led public surface (commented); formatUsdFromCents keeps cents on non-integers; filled "See your new balance" CTA only on genuine paid state; text-brand Coins icon is earned-emerald; FAQ details slide is reduced-motion gated.

## Questions to Consider
1. If the success page is honest enough to say "credits come from the webhook," why does the pricing CTA look broken for the one moment that decides the sale?
2. "Where most searches start" is a behavioral claim with no visible evidence on a brand built on "show your work" — Truth Guard violation in coach's clothing?
3. Packs-as-rows escaped the three-card reflex — but a Free card still sits beside it on desktop; left the category, or rotated it 90°?
