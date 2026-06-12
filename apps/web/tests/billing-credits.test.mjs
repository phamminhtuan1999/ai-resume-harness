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
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.grant, {
    userId: "7b190da1-58ac-411f-8e39-a6936f092ad4",
    packId: "builder",
    credits: 60,
    amountTotal: 1900,
    currency: "usd",
    checkoutSessionId: "cs_test_123",
    paymentIntentId: "pi_test_123",
  });
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
