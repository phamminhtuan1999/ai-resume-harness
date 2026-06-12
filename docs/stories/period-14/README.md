# Period 14 - Pricing Finalization and Credits

## Goal

Move ApplyWise from the MVP pricing placeholder toward paid prepaid credits
without weakening the existing payment-safety contract prematurely.

The current product contract says `/pricing` is a placeholder and must not
collect payment details or start checkout. Period 14 is the selected post-MVP
billing initiative that can change that contract after the pricing offer,
Stripe integration shape, credit ledger model, webhook handling, and go-live
validation are agreed and proven.

Intake: #48 (change request, high-risk lane - external systems, public
contracts, data model, audit/security, and weak proof).

## Stories

| Story | Title | Shape |
| --- | --- | --- |
| US-064 | Check and finalize the pricing page | Normal flat story |
| US-065 | Integrate credit payment processing | High-risk folder `US-065-payment-processing/` |

## Scope Summary

- US-064 finalizes the public pricing page copy, credit pack comparison,
  responsive layout, and launch-state CTA behavior. It must preserve safe
  fallback behavior when Stripe env vars are missing.
- US-065 adds one-time credit purchases with Stripe Checkout, signed webhook
  handling, append-only credit ledger persistence, balance display, and later
  spend checks for paid AI workflows.
- No payment details are collected directly by ApplyWise; hosted Stripe
  surfaces own checkout and payment-method management unless a later decision
  explicitly changes that direction.
- Subscriptions remain deferred; they may later include monthly credits.

## Validation Shape

Pricing needs unit/static checks for honest copy, credit pack math, and safe
checkout fallback, plus desktop and mobile browser checks. Payment processing
needs provider test-mode integration proof, signed webhook tests, credit-ledger
database tests, checkout return/cancel paths, logs/audit evidence, and a Stripe
go-live checklist review before production activation.
