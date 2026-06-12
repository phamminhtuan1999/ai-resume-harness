# Credits-First Billing

Date: 2026-06-12

## Status

Accepted

## Context

ApplyWise's AI workflows have variable provider cost and users may not need a
monthly subscription before they trust the product. The MVP pricing page was a
placeholder with no checkout. The owner accepted a credits-first approach after
asking whether users should buy "points" and spend them inside the app.

## Decision

Use prepaid credits as the first paid billing model.

- Call the unit `credits`, not points.
- Sell credit packs with Stripe Checkout in one-time payment mode.
- Grant credits only after a signed Stripe webhook confirms payment.
- Store credits in an append-only ledger instead of a mutable balance field.
- Spend credits from server-side app actions before paid AI workflows run.
- Keep payment details on Stripe-hosted surfaces; ApplyWise does not collect
  card data directly.
- Subscriptions remain a later option, potentially as monthly included credits.

Initial pack and spend model:

| Item | Credits / Price |
| --- | ---: |
| Starter pack | 20 credits for $9 |
| Builder pack | 60 credits for $19 |
| Pro pack | 150 credits for $39 |
| Job analysis refresh | 1 credit |
| Tailored CV generation | 3 credits |
| Cover letter | 2 credits |
| Roadmap | 2 credits |
| Interview prep | 2 credits |
| PDF/DOCX export | 1 credit or free, to finalize in the pricing story |

## Alternatives Considered

1. Subscription-first Stripe Billing. Deferred because recurring subscriptions
   add cancellation, dunning, portal, and entitlement complexity before the
   product has clear usage patterns.
2. Raw "points" balance. Rejected in naming because credits better matches a
   professional SaaS purchase model and is clearer for support.
3. Trust checkout return parameters to grant credits. Rejected because webhook
   confirmation is the durable payment source of truth.

## Consequences

Positive:

- Lower implementation and launch risk than full subscription management.
- Cost exposure is bounded by credits granted.
- Users can try paid workflows without a recurring commitment.
- The ledger gives support and audit visibility into every grant and spend.

Tradeoffs:

- Revenue is less predictable than subscriptions.
- The app needs clear low-credit and no-credit states before gating workflows.
- Later subscriptions will need a second decision for monthly included credits,
  rollover, and cancellation behavior.

## Follow-Up

- Implement credit purchases, webhook grant, and balance display in Period 14.
- Add spend checks to paid AI workflows after the purchase path is verified.
- Decide whether PDF/DOCX export costs a credit before launch.
