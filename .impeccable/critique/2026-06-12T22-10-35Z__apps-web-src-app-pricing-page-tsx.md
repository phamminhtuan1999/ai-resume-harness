---
target: /pricing
total_score: 14
p0_count: 0
p1_count: 3
timestamp: 2026-06-12T22-10-35Z
slug: apps-web-src-app-pricing-page-tsx
---
# Critique: /pricing (public credit-pack pricing page)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Buy submit has no pending state (no `useFormStatus` anywhere in pricing/billing) — dead air while the Stripe session is created; /billing/success shows no balance |
| 2 | Match System / Real World | 1 | "Webhook-confirmed credits", "server-side spend rules", "Setup pending" — engineering vocabulary at a consumer payment moment |
| 3 | User Control and Freedom | 2 | Stripe cancel_url returns cleanly; signed-out buyers lose their pack choice; no refund/expiry info |
| 4 | Consistency and Standards | 1 | Drops the homepage shell: non-sticky header, max-w-5xl vs 6xl, no footer, no brand wash, no motion |
| 5 | Error Prevention | 2 | Missing-env state honestly disables buttons; double-submit creates duplicate Stripe sessions; signed-out Buy not prevented or labeled |
| 6 | Recognition Rather Than Recall | 1 | Credit costs live two cards below the pack decision; cost rows show bare unit-less numbers ("3") |
| 7 | Flexibility and Efficiency | 3 | Direct per-pack Buy is a short path; "Back to pricing" on success supports re-purchase |
| 8 | Aesthetic and Minimalist Design | 2 | Clean and slop-free, but minimal to the point of register error; lower half is three monotone stacked gray cards |
| 9 | Error Recovery | 1 | "Try again or contact support" links to no support; `?billing=checkout-error` persists after recovery |
| 10 | Help and Documentation | 0 | No FAQ, refund policy, credit-expiry statement, terms/privacy links, or support contact on a page that takes money |
| **Total** | | **14/40** | **Poor — transactionally sound, experientially unfinished** |

## Anti-Patterns Verdict

**LLM assessment:** Leaning — fails the brand bar, not the template bar. Packs-as-rows on an asymmetric 0.8fr/1.2fr grid structurally transcends the modal three-equal-cards answer; no banned pattern fires. But the page is exactly the "generic shadcn defaults" PRODUCT.md rejects: rendered HTML confirms zero `brand-radial`, zero `rise`/`reveal`, no footer, non-sticky header — on the one public page where money changes hands, while the homepage has all five. Copy leaks internal vocabulary ("Credits-first billing" is the title of decision doc 0020). Verdict: not template slop — register slop.

**Deterministic scan:** 0 findings, exit 0, across `app/pricing` + `app/billing` + `marketing-auth-nav.tsx` (engine self-test passed; true negative). Agrees with the review: the failures here are register/trust judgment calls outside any regex.

**Visual overlays:** Not available — Claude-in-Chrome extension not connected. Fallback evidence: rendered-HTML audit via curl against the live dev server confirmed the class-level absences above, live Buy buttons (billing env configured), and that `GET /billing/success?session_id=cs_test_fake` returns 200 asserting "Payment received" without reading the param.

## Overall Impression

The transactional engineering under this page (webhook-only grants, idempotent ledger, honest env-missing states) deserves far more trust than the surface earns. It reads as a workspace settings card, not a brand-led public page; it never answers "how many credits do I need?"; and the buy → success arc is fragile at the click and anticlimactic at the peak. The single biggest opportunity: make the pricing page give a verdict — the one thing this product is best at.

## What's Working

1. **Packs-as-rows beats the category default** — one Credit packs card with three compact rows honestly models "same product, different quantity" and keeps all prices in one fixation.
2. **Trust note in the right place** — "Checkout is hosted by Stripe; ApplyWise never collects card details" sits in the hero subhead before any button. Plain-language, evidence-shaped, honest-coach register.
3. **Honest failure plumbing** — disabled "Setup pending" instead of dead clicks, explicit error states, clean cancel_url return, webhook-only credit grants.

## Priority Issues

- **[P1] Brand absence violates "brand-led in public"**: no brand-radial, no rise/reveal, non-sticky header, max-w-5xl, no footer (all confirmed in rendered HTML). **Why:** the page taking money is the least branded page in the product; trust and identity are the whole job here. **Fix:** adopt the homepage shell (sticky blurred header, footer with terms/privacy/support, max-w-6xl), brand-radial behind the hero, rise stagger on badge/h1/lede, reveal on the two cards. **Command:** /impeccable bolder (brand register)
- **[P1] Credit comprehension gap**: visitors can't map credits → outcomes without cross-card arithmetic; $/credit never shown; "Limited match analysis" gives no number; cost rows are unit-less and lack tabular-nums. **Why:** the core purchase decision is unsupported — the worst cognitive-load failure on the page. **Fix:** per-pack outcome line ("Starter ≈ 5 jobs: analysis + tailored CV each"), $/credit, anchor costs beside packs, append "credits" unit. **Command:** /impeccable clarify
- **[P1] Buy interaction is fragile at the money moment**: no pending state, double-submit creates duplicate Stripe sessions, signed-out click silently POSTs then bounces to /sign-in losing the chosen pack (no redirect_url back). **Fix:** useFormStatus pending + disabled state ("Opening Stripe checkout…"), auth-aware label via the MarketingAuthNav pattern, `redirect("/sign-in?redirect_url=/pricing")`. **Command:** /impeccable harden
- **[P2] Mechanics-first copy violates "decision first, mechanics last"**: "Webhook-confirmed credits" card, "server-side spend rules as each workflow is gated", "Credits-first billing" badge. **Fix:** rewrite for buyers; badge becomes the real value prop: "Pay as you go — no subscription". **Command:** /impeccable clarify
- **[P2] Post-purchase peak is the weakest page in the funnel, and it lies when visited cold**: /billing/success asserts "Payment received" without verifying session_id (verified live), shows no balance, routes the user to /settings. **Fix:** verify the session server-side (or soften copy), show the balance, primary CTA continues the loop ("Open your matches"). **Command:** /impeccable harden + delight
- **[P3] One Voice Rule violation**: setup-pending alert uses raw amber literals (`border-amber-500/30...`) instead of the `warning` token. **Command:** /impeccable polish

## Persona Red Flags

**Jordan (first-timer):** reads "Buy credits for focused AI job search work." before knowing what a credit is; "Limited match analysis" gives no number; "**Initial** prices" reads as "prices will change after I pay"; nothing answers expiry/refunds/failed-generation credit return; nothing tells him Starter's 20 credits covers his 5 target jobs exactly.

**Casey (mobile):** non-sticky header = no orientation after scrolling; pack rows collapse to three identical full-width "Buy $X" buttons where one mis-tap goes straight to checkout-session creation with zero feedback → double-tap; bare right-aligned digits read as noise.

**Riley (stress tester):** signed-out Buy discards pack choice and pricing context; double-click creates two checkout sessions; back-from-Stripe passes; `/billing/success?session_id=garbage` → 200 "Payment received" (false assertion, verified); `?billing=checkout-error` persists in the URL after recovery.

## Minor Observations

- h1 is text-4xl/5xl — between display and headline specs; sub-page step-down is fine but unnamed in the system.
- CheckCircle2 check-bullets in the Free card are the page's one cliché-adjacent element.
- `formatUsdFromCents` uses toFixed(0) — a $19.50 pack would render "$20" (latent copy bug).
- Success page lacks ThemeToggle/nav parity — logo only.
- The webhook explainer card gets the same visual rank as the purchase decision.
- Good invisible engineering: `route-policy.mjs` routes POST /pricing through the Clerk proxy so the server action can authenticate.

## Questions to Consider

1. The product's signature is rendering a verdict from evidence — why does its own pricing page refuse to give one? ("Targeting 5 roles? That's ~20 credits — Starter.")
2. "Starter / Builder / Pro" are the most training-data tier names in SaaS. What if packs were named for search intents — "One role / Active search / Full pivot"?
3. The user's largest act of trust currently terminates in /settings. What would it mean for /billing/success to be the best page in the product?
