---
target: /pricing
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-12T23-48-10Z
slug: apps-web-src-app-pricing-page-tsx
---
# Critique: /pricing (public credit-pack pricing page) — run 2

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Success page never polls/refreshes and never shows the resulting balance |
| 2 | Match System / Real World | 3 | Outcomes translated to jobs/applications (excellent); "Setup pending" is internal jargon |
| 3 | User Control and Freedom | 3 | Stripe cancel returns cleanly, error has Dismiss; success page has no escape if "Finalizing" never resolves |
| 4 | Consistency and Standards | 3 | Shares the homepage shell; price lives only inside the buy button; Free card CTA doesn't adapt for signed-in users |
| 5 | Error Prevention | 4 | Double-submit guarded, signed-out honest, env-missing disabled, server re-checks auth |
| 6 | Recognition Rather Than Recall | 3 | Cost table adjacent, outcomes precomputed; verifying a pack claim still needs cross-referencing |
| 7 | Flexibility and Efficiency | 2 | No pack deep-linking/preselection; checkout-error recovery means re-finding your pack |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and calm; below the hero it's default-card sameness on a brand-led surface |
| 9 | Error Recovery | 2 | Checkout error gives no cause; refund path is reply-to-receipt only |
| 10 | Help and Documentation | 3 | FAQ pre-empts the four real anxieties |
| **Total** | | **28/40** | **Good — address weak areas** (was 14/40) |

## Anti-Patterns Verdict

**LLM assessment: No on the ban list; leaning on distinctiveness.** Packs-as-rows still escapes the category default, and the outcome lines + failure FAQ are voiced, specific, honest-coach material a competitor page wouldn't have. Below the hero the composition is stock shadcn grammar — clean on bans, generic in body, voice rescues it.

**Deterministic scan:** 0 findings, exit 0 across pricing + billing + nav + buy button (engine self-test passed).

**Visual overlays:** unavailable (extension not connected). Fallback: curl audit of rendered HTML confirmed brand-radial ×2, rise/reveal classes, live "Buy $9/$19/$39", per-credit figures 45¢/32¢/26¢ — and that a fake session_id renders the full "Finalizing your payment…" promise.

## Overall Impression

Doubled its score: the trust plumbing (double-submit guard, honest signed-out path, session-verified copy, outcome translation, failure FAQ) now mostly matches the honest engineering underneath. The remaining gap is the end of the arc — a success page that can't see the webhook it promises — and a fake-session edge where the new copy still over-promises.

## What's Working

1. **Outcome translation** — packOutcomes converts credits to "5 jobs end to end" with the arithmetic documented against CREDIT_ACTION_COSTS. Truth Guard applied to pricing copy.
2. **The failure FAQ is genuinely honest-coach** — admits the charge-at-start asymmetry for refreshes; "1 credit is 1 credit" is a real commitment.
3. **State integrity end-to-end** — honest "Sign in to buy", redirect_url round-trip, session-verified success copy, webhook-only grants.

## Priority Issues

- **[P1] Success page treats an unverifiable session as "in flight"**: getCheckoutSessionSummary returns null for a fake/garbage id and the page collapses null into "Finalizing your payment… nothing else is needed from you" — a permanent false promise (verified live). **Fix:** distinguish session-not-found from payment-pending; give pending an escape hatch ("Still waiting after a minute? …"). **Command:** /impeccable harden
- **[P1] The purchase peak-end is static**: never polls, never shows the credited balance. **Fix:** client poll / meta-refresh on the pending branch; make the verified branch point at the balance concretely. **Command:** /impeccable harden + delight
- **[P1] Signed-out CTA flicker**: SSR paints "Buy $9", Clerk hydration swaps all three to "Sign in to buy" — show-then-revoke on the page's primary actions. **Fix:** stable label or neutral state until isLoaded. **Command:** /impeccable polish
- **[P2] Price buried in buttons; no recommended pack**: $9/$19/$39 exist only as button labels; no honest default ("Where most searches start"). **Fix:** price as a tabular row figure + one recommendation. **Command:** /impeccable layout + clarify
- **[P2] Brand goes quiet below the hero**: the pack card — the page's reason to exist — is indistinguishable from a workspace card on a surface licensed to be brand-led. **Fix:** one earned brand moment on the pack card (emerald-wash header band / Sora pack names). **Command:** /impeccable bolder

## Persona Red Flags

**Jordan:** never told what a credit is before being shown 20; "Your first fit analysis is included free" — the most reassuring fact — hides as a cost-card caption; "Setup pending" reads as broken.

**Casey:** stacked full-width Buy buttons with the differentiator text between them invite wrong-pack taps; the Free card renders first on mobile so her first CTA is "Start workspace" on a pricing page.

**Riley:** double-click guarded (pass); back-from-Stripe clean (pass); signed-out buy round-trips but drops the pack choice (P3); fake session_id → permanent "Finalizing" promise (fail, P1 above).

## Minor Observations

centsPerCredit rounds where formatUsdFromCents refuses to; setup-pending state is duplicated in banner + button labels; ArrowRight-rotating-90° disclosure is unconventional but consistent; success page header drops auth nav (signed-in buyer has no "Open dashboard"); the hero's deliberate half-step down from the homepage (py-14, text-5xl) reads correctly as a transactional sibling.

## Questions to Consider

1. The post-purchase trust story is "the webhook will land" — what would it take for /billing/success to be the moment the balance visibly ticks up?
2. Could packs be priced in the user's own currency ("5 full applications — $9") with credits demoted to mechanics, per the product's own verdict→evidence→mechanics hierarchy?
3. Three packs, no recommendation: is neutrality honesty, or abdication?
