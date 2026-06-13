export const CREDIT_PACKS = [
  {
    id: "starter",
    name: "Starter",
    credits: 20,
    priceCents: 900,
    description: "Try the paid AI workflow loop on a few targeted jobs.",
  },
  {
    id: "builder",
    name: "Builder",
    credits: 60,
    priceCents: 1900,
    description: "Build a focused pipeline with analysis, CVs, and prep.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 150,
    priceCents: 3900,
    description: "Run a full high-effort search without a subscription.",
  },
];

export const CREDIT_ACTION_COSTS = [
  { id: "job_analysis_refresh", label: "Job analysis refresh", credits: 1 },
  { id: "tailored_cv_generation", label: "Tailored CV generation", credits: 3 },
  { id: "cover_letter", label: "Cover letter", credits: 2 },
  { id: "roadmap", label: "Roadmap", credits: 2 },
  { id: "interview_prep", label: "Interview prep", credits: 2 },
  { id: "pdf_docx_export", label: "PDF/DOCX export", credits: 1 },
];

export function formatUsdFromCents(priceCents) {
  const dollars = priceCents / 100;
  // Whole-dollar packs stay terse ("$9"); anything else keeps its cents
  // instead of silently rounding ("$19.50", never "$20").
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function getCreditPack(packId) {
  return CREDIT_PACKS.find((pack) => pack.id === packId) ?? null;
}

export function calculateCreditBalance(rows) {
  return rows.reduce((sum, row) => {
    if (row?.status && row.status !== "posted") {
      return sum;
    }
    const delta = Number(row?.credits_delta ?? 0);
    return Number.isInteger(delta) ? sum + delta : sum;
  }, 0);
}

// Events stuck in these states never produced a posted ledger row (the worker
// failed or died mid-grant), so a Stripe retry must be allowed to finish the
// grant instead of short-circuiting as a duplicate.
export function isRetryableBillingEventResult(processingResult) {
  return processingResult === "received" || processingResult === "failed";
}

export function buildCreditGrantFromCheckoutSession(session) {
  if (!session || typeof session !== "object") {
    return { ok: false, reason: "missing_session" };
  }

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid_payment_session" };
  }

  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  if (metadata.billing_kind !== "credit_pack") {
    return { ok: false, reason: "not_credit_pack" };
  }

  const pack = getCreditPack(String(metadata.pack_id || ""));
  if (!pack) {
    return { ok: false, reason: "unknown_pack" };
  }

  const userId = String(metadata.user_id || "");
  if (!userId) {
    return { ok: false, reason: "missing_user" };
  }

  const credits = Number(metadata.credits);
  if (!Number.isInteger(credits) || credits !== pack.credits) {
    return { ok: false, reason: "credit_mismatch" };
  }

  return {
    ok: true,
    grant: {
      userId,
      packId: pack.id,
      credits,
      amountTotal: typeof session.amount_total === "number" ? session.amount_total : pack.priceCents,
      currency: String(session.currency || "usd"),
      checkoutSessionId: String(session.id || ""),
      paymentIntentId:
        typeof session.payment_intent === "string" && session.payment_intent
          ? session.payment_intent
          : null,
    },
  };
}
