import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreditGrantFromCheckoutSession,
  calculateCreditBalance,
  CREDIT_ACTION_COSTS,
  CREDIT_PACKS,
  formatUsdFromCents,
  getCreditPack,
  isRetryableBillingEventResult,
} from "../src/lib/billing-credits.mjs";

test("credit packs expose accepted starter, builder, and pro prices", () => {
  assert.deepEqual(
    CREDIT_PACKS.map((pack) => ({
      id: pack.id,
      credits: pack.credits,
      price: formatUsdFromCents(pack.priceCents),
    })),
    [
      { id: "starter", credits: 20, price: "$9" },
      { id: "builder", credits: 60, price: "$19" },
      { id: "pro", credits: 150, price: "$39" },
    ]
  );
  assert.equal(getCreditPack("builder").credits, 60);
  assert.equal(getCreditPack("missing"), null);
});

test("credit action costs include the first paid workflow rules", () => {
  assert.deepEqual(
    CREDIT_ACTION_COSTS.map((item) => [item.id, item.credits]),
    [
      ["job_analysis_refresh", 1],
      ["tailored_cv_generation", 3],
      ["cover_letter", 2],
      ["roadmap", 2],
      ["interview_prep", 2],
      ["pdf_docx_export", 1],
    ]
  );
});

test("credit balance is derived from posted ledger deltas only", () => {
  assert.equal(
    calculateCreditBalance([
      { credits_delta: 20, status: "posted" },
      { credits_delta: -3, status: "posted" },
      { credits_delta: 60, status: "void" },
      { credits_delta: "bad", status: "posted" },
    ]),
    17
  );
});

test("paid credit checkout session builds a ledger grant", () => {
  const result = buildCreditGrantFromCheckoutSession({
    id: "cs_test_123",
    mode: "payment",
    payment_status: "paid",
    payment_intent: "pi_test_123",
    amount_total: 1900,
    currency: "usd",
    metadata: {
      billing_kind: "credit_pack",
      pack_id: "builder",
      credits: "60",
      user_id: "7b190da1-58ac-411f-8e39-a6936f092ad4",
      clerk_user_id: "user_2abc",
      email: "buyer@example.com",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.grant, {
    userId: "7b190da1-58ac-411f-8e39-a6936f092ad4",
    clerkUserId: "user_2abc",
    email: "buyer@example.com",
    packId: "builder",
    credits: 60,
    amountTotal: 1900,
    currency: "usd",
    checkoutSessionId: "cs_test_123",
    paymentIntentId: "pi_test_123",
  });
});

test("grant carries self-heal identity, falling back across metadata and session", () => {
  // Brand-new buyer: the webhook needs clerk_user_id + email to upsert a
  // not-yet-visible user_profiles row instead of failing the ledger FK.
  const fromCustomerEmail = buildCreditGrantFromCheckoutSession({
    id: "cs_test_456",
    mode: "payment",
    payment_status: "paid",
    amount_total: 900,
    currency: "usd",
    customer_email: "fallback@example.com",
    metadata: {
      billing_kind: "credit_pack",
      pack_id: "starter",
      credits: "20",
      user_id: "u-1",
      clerk_user_id: "user_new",
    },
  });
  assert.equal(fromCustomerEmail.grant.clerkUserId, "user_new");
  assert.equal(fromCustomerEmail.grant.email, "fallback@example.com");

  // Older in-flight session predating the metadata keys: identity stays empty
  // so the webhook keeps the existing user_id path.
  const legacy = buildCreditGrantFromCheckoutSession({
    id: "cs_test_789",
    mode: "payment",
    payment_status: "paid",
    amount_total: 900,
    currency: "usd",
    metadata: {
      billing_kind: "credit_pack",
      pack_id: "starter",
      credits: "20",
      user_id: "u-2",
    },
  });
  assert.equal(legacy.grant.clerkUserId, "");
  assert.equal(legacy.grant.email, "");
});

test("stranded webhook events stay retryable so credits are not lost", () => {
  // 'received' = worker died before the ledger insert; 'failed' = ledger
  // insert errored. Stripe retries the same event id and must be allowed
  // to finish the grant.
  assert.equal(isRetryableBillingEventResult("received"), true);
  assert.equal(isRetryableBillingEventResult("failed"), true);

  assert.equal(isRetryableBillingEventResult("granted"), false);
  assert.equal(isRetryableBillingEventResult("ignored"), false);
  assert.equal(isRetryableBillingEventResult("duplicate"), false);
  assert.equal(isRetryableBillingEventResult(undefined), false);
});

test("checkout grant parser rejects non-credit or mismatched sessions", () => {
  assert.deepEqual(
    buildCreditGrantFromCheckoutSession({
      id: "cs_test_123",
      mode: "subscription",
      payment_status: "paid",
      metadata: { billing_kind: "credit_pack", pack_id: "starter", credits: "20", user_id: "u" },
    }),
    { ok: false, reason: "not_paid_payment_session" }
  );

  assert.deepEqual(
    buildCreditGrantFromCheckoutSession({
      id: "cs_test_123",
      mode: "payment",
      payment_status: "paid",
      metadata: { billing_kind: "credit_pack", pack_id: "starter", credits: "19", user_id: "u" },
    }),
    { ok: false, reason: "credit_mismatch" }
  );
});
