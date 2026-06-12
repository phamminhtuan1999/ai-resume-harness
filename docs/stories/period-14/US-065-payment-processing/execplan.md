# Exec Plan - US-065 Integrate Credit Payment Processing

## Goal

Complete a test-mode-proven credit payment integration that lets ApplyWise
users buy prepaid credits through Stripe-hosted Checkout, with credit grants
derived from signed webhooks and balance derived from an append-only ledger.

## Scope

In scope:

- Durable credits-first billing architecture decision.
- Product-doc updates that replace the MVP no-payment placeholder with
  post-MVP billing behavior.
- Stripe Checkout Session integration for one-time credit purchases.
- Signed webhook verification and idempotent processing.
- Local credit ledger and event idempotency tables.
- Server-side balance checks and UI credit-state display.
- Test-mode verification and go-live checklist review.

Out of scope:

- Custom payment forms.
- Marketplace/Connect.
- Team seats.
- Usage-based billing.
- Subscription management, cancellation, dunning, and Customer Portal.
- Tax, coupon, and invoice customization beyond Stripe configuration unless
  the owner explicitly adds those requirements.
- Production Stripe activation before validation is complete.

## Risk Classification

Risk flags:

- External systems.
- Public contracts.
- Data model.
- Audit/security.
- Existing behavior.
- Weak proof.

Hard gates:

- External provider behavior.
- Audit/security.

## Work Phases

1. Discovery: confirm credit pack prices, per-workflow credit costs,
   refund/support policy, Stripe account mode, and required environment
   variables.
2. Decision: create a durable billing architecture decision before
   implementation.
3. Product contract: update product docs for post-MVP billing behavior and
   pricing-page launch state.
4. Data model: add credit ledger and webhook idempotency migrations.
5. Provider integration: add checkout-session and signed webhook handling.
6. Credits: add server-side balance helpers and credit-state display.
7. Pricing finalization: connect pricing pack CTAs to checkout only after the
   purchase path is test-mode verified.
8. Verification: run unit, integration, E2E, platform, and webhook replay tests;
   review Stripe go-live checklist before production enablement.
9. Harness update: update story evidence, durable matrix proof, decision row,
   and trace.

## Stop Conditions

Pause for human confirmation if:

- Credit pack prices or per-workflow credit costs are undefined.
- Low-credit/no-credit workflow behavior is ambiguous.
- Stripe account/product/price ids are missing.
- Webhook signature verification or idempotency cannot be tested locally.
- Production activation is requested before test-mode proof passes.
- Tax, refunds, coupons, subscriptions, teams, seats, or usage-based pricing
  become required.
