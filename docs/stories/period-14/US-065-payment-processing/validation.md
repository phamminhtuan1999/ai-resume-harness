# Validation - US-065 Integrate Credit Payment Processing

## Proof Strategy

Payment processing is complete only when the local app proves the full credit
purchase lifecycle in Stripe test mode: checkout starts from an authenticated
server-side command, Stripe-hosted checkout completes, signed webhooks insert a
posted credit grant idempotently, balance checks read the derived ledger sum,
and failure states are visible without granting credits incorrectly.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Billing config parsing; credit pack lookup; credit balance math; pricing CTA state; webhook signature verification; checkout completion reducer; duplicate-event guard. |
| Integration | Checkout-session command creates a payment session for the selected pack; webhook rejects invalid signatures; valid checkout completion inserts a credit ledger grant; duplicate event is skipped safely. |
| E2E | Signed-in user starts checkout from `/pricing`, returns from test checkout, waits for webhook-confirmed credits, and sees balance state. |
| Platform | Stripe CLI or equivalent webhook forwarding documented; required env vars checked; production mode blocked without go-live approval. |
| Performance | Webhook handler completes quickly and avoids blocking on unrelated UI refresh work. |
| Logs/Audit | Logs include event id/type/result and credit grant/spend transition; logs exclude payment method details and full provider payloads. |

## Fixtures

- Clerk/Supabase seeded signed-in user.
- Stripe test-mode checkout for Starter, Builder, and Pro credit packs.
- Stripe test cards for successful payment, failed payment, and authentication
  required when applicable.
- Captured or generated Stripe test webhook payloads for checkout completed,
  async payment failed, and duplicate delivery states.

## Commands

```bash
npm run test --workspace apps/web
npm run lint --workspace apps/web
apps/web/node_modules/.bin/tsc --noEmit --project apps/web/tsconfig.json
npm run build --workspace apps/web
curl -sS -I http://127.0.0.1:3000/pricing
curl -sS -i -X POST http://127.0.0.1:3000/api/billing/stripe/webhook \
  -H 'content-type: application/json' \
  --data '{}'
```

## Acceptance Evidence

Started 2026-06-12.

- Added migration `0026_period14_billing_credits.sql`.
- Added credit pack/balance/grant parser unit tests.
- Added server-side Checkout Session creator using Stripe Checkout
  `mode=payment`.
- Added signed webhook route and idempotent ledger grant processor.
- Added settings credit balance display.
- Added first spend gates for job-analysis refresh, Tailored CV generation,
  cover letter, roadmap, and interview prep. Gates enforce only when Stripe
  billing env vars are configured; local unconfigured dev remains usable.
- Confirmed `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_APP_URL`, and `SUPABASE_DB_URL` are present in `apps/web/.env`
  without printing secret values.
- Applied migration `0026_period14_billing_credits.sql` to live Supabase and
  verified `billing_events`, `billing_credit_ledger`, and
  `spend_billing_credits` exist.
- Verified a rollback-only live database proof: temporary credits were inserted,
  `spend_billing_credits` returned `spend_ok`, and the transaction rolled back.
- Fixed public route middleware behavior so `/pricing`, `/billing/success`, and
  the Stripe webhook route are not blocked by Clerk dev-browser middleware while
  protected app routes remain guarded.
- `npm run test --workspace apps/web` passed 252 tests.
- `npm run lint --workspace apps/web` passed.
- `apps/web/node_modules/.bin/tsc --noEmit --project apps/web/tsconfig.json`
  passed.
- `npm run build --workspace apps/web` passed after approved network access for
  Next font fetches.
- Local dev server loaded `apps/web/.env`; `GET /pricing` returned 200 and
  rendered enabled `Buy $9`, `Buy $19`, and `Buy $39` controls.
- Unsigned `POST /api/billing/stripe/webhook` returned 400
  `Missing Stripe signature`, confirming the route is reachable and fails
  safely without a Stripe signature.
- `/billing/success` rendered the webhook-confirmed credit copy.

Completed 2026-06-12 (payment-flow recheck session):

- Fixed signed-in users seeing a hardcoded Sign in button on `/pricing` and the
  home header: new `MarketingAuthNav` client component resolves the Clerk
  session after hydration and swaps to an Open dashboard link, with a static
  fallback when Clerk env is missing. GET `/pricing` stays outside the Clerk
  proxy per the route-policy contract.
- Fixed webhook retry credit loss: `billing_events` stuck in
  `received`/`failed` are retryable instead of short-circuiting as duplicate;
  a ledger 23505 on the unique checkout-session constraint records the event
  as `granted`; empty checkout session ids store as NULL. New pure helper
  `isRetryableBillingEventResult` with unit coverage.
- `npm run test --workspace apps/web` passed 255 tests; lint and tsc clean.
- Stripe CLI webhook replay: `stripe listen` forwarded a resent
  `checkout.session.completed` (`evt_1ThaRuRMxYHHSkb7QfMKHEoZ`); the handler
  returned 200, the event row stayed `granted`, and the ledger row count and
  derived balance were unchanged — duplicate delivery proven against live
  Supabase.
- Stripe test-mode checkout completion: owner completed a real Starter pack
  purchase from `/pricing` in a signed-in browser with test card 4242. Event
  `evt_1Thb0kRMxYHHSkb7UlYASMWB` was forwarded, processed `granted`, and
  inserted a posted +20 starter ledger row ($9.00) attributed to the owner's
  profile; derived balance moved 210 -> 230.

Completed 2026-06-14 (first-purchase credit-loss fix):

- Fixed a brand-new buyer's first purchase not crediting. The ledger
  `user_id` FK requires a `user_profiles` row, but a new buyer's profile is
  created in the very same `startCreditCheckoutAction` that launches the
  payment, so it can be absent or not yet visible to the webhook's pooled
  connection when the event fires. The ledger insert then failed `23503`, the
  event was marked `failed`, and Stripe's retry could not recover because the
  webhook only had the profile UUID — not the `clerk_user_id`/`email` needed to
  recreate the row. Net effect: a first purchase was lost while later ones (once
  the profile was solidly present) worked.
- Front-door gate (primary fix): a buyer with no resume can no longer reach
  Stripe. `startCreditCheckoutAction` now checks the resume count and redirects
  to `/resumes/new?from=buy-credits` (the import flow, which also completes the
  profile) instead of selling an unusable balance — credits are only spendable
  on resume × job workflows. The import page shows a short "add a resume first"
  notice when arrived from this gate. This keeps brand-new users out of the
  fragile create-profile-then-immediately-pay path entirely.
- Webhook self-heal (safety net for races/retries): checkout now carries
  `metadata.clerk_user_id` and `metadata.email` (`billing-stripe.ts`,
  `billing-actions.ts`); the grant parser surfaces both (`billing-credits.mjs`);
  and the webhook self-heals the profile via an upsert by `clerk_user_id` before
  the ledger insert, granting against the canonical id it returns
  (`billing-ledger.ts` `resolveGrantUserId`). Idempotent under retries; older
  in-flight sessions without the new metadata keep the prior `user_id` path
  unchanged. No schema change.
- `npm run test --workspace apps/web` passed 268 tests (new grant-identity
  coverage) on Node 24; lint and tsc clean. (Note: the repo's tests/lint need
  Node 18+; a Node 16 shell fails 6 unrelated File/structuredClone tests.)

Still pending:

- Stripe go-live checklist review before production activation.
- Live recheck of a genuinely new account (no resume/jobs) completing a first
  purchase end-to-end against Supabase.
