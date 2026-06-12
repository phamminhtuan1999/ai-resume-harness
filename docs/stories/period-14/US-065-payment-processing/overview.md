# Overview - US-065 Integrate Credit Payment Processing

## Current Behavior

ApplyWise now has the first credits implementation slice: pricing credit packs,
a checkout server action, a Stripe webhook route, a billing event table, an
append-only credit ledger table, and a settings balance display. Live Stripe
test-mode checkout, webhook replay proof, and workflow spend gates are still
pending.

## Target Behavior

ApplyWise supports self-service prepaid credit purchases. A signed-in user can
start checkout from the finalized pricing page, complete a Stripe-hosted
one-time payment, return to ApplyWise, and see credits granted after a signed
Stripe webhook confirms payment.

Credit balance is derived from an append-only ledger. Purchase grants and later
workflow spends are persisted as ledger rows. UI copy makes payment state clear
without claiming credits before webhook confirmation.

## Affected Users

- Signed-out visitor comparing plans.
- Signed-in account owner starting or managing a subscription.
- Paid user whose workflow access depends on current credit balance.
- Support/operator reviewing payment-related failures.

## Affected Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/stories/period-14/README.md`
- `docs/decisions/0020-credits-first-billing.md`

## Non-Goals

- Building a custom card form inside ApplyWise.
- Subscriptions, renewals, cancellation, dunning, or Customer Portal.
- Marketplace, Connect, seat-based teams, metered usage, coupons, taxes, or
  invoices beyond what Stripe Checkout handles by configuration.
- Production activation without Stripe test-mode proof and go-live checklist
  review.
