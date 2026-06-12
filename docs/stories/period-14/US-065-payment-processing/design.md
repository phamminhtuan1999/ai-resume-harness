# Design - US-065 Integrate Credit Payment Processing

## Domain Model

- `CreditPack`: static purchasable pack id, display name, credits, and price.
- `BillingEvent`: idempotency record for processed Stripe webhook event ids.
- `CreditLedgerEntry`: append-only grant or spend row with credit delta,
  source, related provider id, and metadata.
- `CreditBalance`: derived sum of posted ledger deltas for a user.

Business rules:

- Use Stripe Checkout Sessions in `payment` mode for one-time credit purchases.
- Use hosted Checkout with dynamic price data for the static credit packs.
- ApplyWise never stores raw payment method details.
- Checkout return pages are informational only. Credits are granted only after
  signed webhook processing confirms payment.
- Credit balance is never updated by client input or checkout return params.

## Application Flow

1. User opens `/pricing` and chooses Pro.
2. If signed out, the app routes to sign-in/sign-up and returns to the checkout
   intent.
3. A signed-in user starts a server-side checkout-session command.
4. Server creates or reuses the Stripe customer for the current user/workspace.
5. Server creates a Stripe Checkout Session with `mode: "payment"` and line
   item metadata for the selected credit pack.
6. User completes hosted checkout on Stripe and returns to ApplyWise.
7. Stripe sends signed webhook events; the webhook handler verifies the
   signature, stores an idempotency record, and inserts a posted credit grant
   ledger row.
8. App spend checks read the derived balance before paid AI workflows run.

## Interface Contract

Candidate routes or server actions:

- `POST /billing/checkout` or equivalent server action creates a Checkout
  Session for the authenticated user and selected credit pack.
- `POST /api/billing/stripe/webhook` verifies Stripe signatures and processes
  checkout completion events idempotently.
- `/billing/return` and `/billing/cancel` render safe user guidance without
  granting credits directly.

Error shape should distinguish unauthenticated, missing Stripe configuration,
invalid credit pack, provider failure, invalid webhook signature, duplicate event,
and unsupported event type.

## Data Model

Expected additive schema, names to be finalized during implementation:

- `billing_credit_ledger`
  - `user_id`
  - `entry_type` (`purchase`, `spend`, `adjustment`)
  - `credits_delta`
  - `status`
  - `source`
  - `stripe_checkout_session_id`
  - `stripe_payment_intent_id`
  - `metadata_json`
  - timestamps
- `billing_events`
  - `stripe_event_id`
  - `event_type`
  - `processed_at`
  - `processing_result`

Use unique constraints on Stripe ids and event ids. Keep webhook processing
idempotent and safe under retries. Balance is `sum(credits_delta)` over posted
ledger rows.

## UI / Platform Impact

- `/pricing` shows credit packs and posts purchase actions to a server action.
- Settings or account billing surface gains current credit balance.
- Paid AI workflow gates must read server-derived credit balance.
- Required environment variables include Stripe secret key and webhook secret.

## Observability

- Structured logs for checkout-session creation, portal-session creation,
  webhook verification failure, webhook duplicate skip, credit grant, and spend.
- Audit-style activity rows for credit purchase and workflow spend if the
  existing activity-feed model is appropriate.
- No logs may include payment method details or full provider payloads.

## Alternatives Considered

1. Subscription-first Stripe Billing. Deferred because the owner accepted
   credits-first and subscriptions add cancellation, dunning, and portal
   complexity before usage patterns are known.
2. Custom embedded card collection. Rejected for this story because hosted
   Stripe Checkout minimizes PCI scope and implementation risk.
3. Trusting checkout return query params for credits. Rejected because webhook
   confirmation is the durable source of truth.
