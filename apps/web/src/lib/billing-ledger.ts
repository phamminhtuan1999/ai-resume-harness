import "server-only";

import {
  buildCreditGrantFromCheckoutSession,
  calculateCreditBalance,
  CREDIT_ACTION_COSTS,
  isRetryableBillingEventResult,
} from "@/lib/billing-credits.mjs";
import { hasStripeBillingEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: unknown;
  };
};

type CreditGrant = {
  userId: string;
  clerkUserId?: string;
  email?: string;
};

// Guarantee a user_profiles row exists for the grant and return the id the
// ledger should reference. When the checkout carried the buyer's Clerk identity
// we upsert by clerk_user_id (the unique key the app keys every profile on) and
// trust the row it returns — this both creates a missing profile and corrects
// any drift between the metadata UUID and the canonical id. If the upsert can't
// run (no clerk identity on older sessions, or an unexpected error) we fall back
// to the grant's UUID so existing behavior is never worse than before.
async function resolveGrantUserId(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  grant: CreditGrant
): Promise<string> {
  if (!grant.clerkUserId || !grant.email) {
    return grant.userId;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: grant.userId,
        clerk_user_id: grant.clerkUserId,
        email: grant.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    console.warn("[ApplyWise billing] profile self-heal skipped", error?.message);
    return grant.userId;
  }

  return data.id;
}

export async function getCreditBalanceForUser(userProfileId: string): Promise<number> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("billing_credit_ledger")
    .select("credits_delta,status")
    .eq("user_id", userProfileId)
    .eq("status", "posted");

  if (error) {
    console.warn("[ApplyWise billing] balance lookup failed", error.message);
    return 0;
  }

  return calculateCreditBalance(data ?? []);
}

export function getCreditCost(actionId: string): number {
  return CREDIT_ACTION_COSTS.find((item) => item.id === actionId)?.credits ?? 0;
}

export async function hasEnoughCredits(userProfileId: string, actionId: string) {
  if (!hasStripeBillingEnv()) {
    return { ok: true, cost: 0, balance: 0, enforced: false };
  }

  const cost = getCreditCost(actionId);
  if (cost <= 0) {
    return { ok: true, cost: 0, balance: 0, enforced: true };
  }

  const balance = await getCreditBalanceForUser(userProfileId);
  return {
    ok: balance >= cost,
    cost,
    balance,
    enforced: true,
  };
}

export async function spendCreditsForAction({
  userProfileId,
  actionId,
  subjectType,
  subjectId,
}: {
  userProfileId: string;
  actionId: string;
  subjectType?: string;
  subjectId?: string;
}) {
  if (!hasStripeBillingEnv()) {
    return { ok: true, spent: false, cost: 0 };
  }

  const cost = getCreditCost(actionId);
  if (cost <= 0) {
    return { ok: true, spent: false, cost: 0 };
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("spend_billing_credits", {
    p_user_id: userProfileId,
    p_credits: cost,
    p_reason: actionId,
    p_subject_type: subjectType ?? null,
    p_subject_id: subjectId ?? null,
  });

  if (error) {
    console.warn("[ApplyWise billing] credit spend failed", error.message);
    return { ok: false, spent: false, cost, message: "Could not record credit spend." };
  }

  if (data !== true) {
    return { ok: false, spent: false, cost, message: `You need ${cost} credits for this action.` };
  }

  return { ok: true, spent: true, cost };
}

export async function processStripeBillingEvent(event: StripeEvent) {
  const stripeEventId = String(event.id || "");
  const eventType = String(event.type || "");
  if (!stripeEventId || !eventType) {
    return { result: "ignored", reason: "missing_event_identity" };
  }

  const supabase = getSupabaseServiceClient();
  const { data: existing } = await supabase
    .from("billing_events")
    .select("id,processing_result")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();

  if (existing?.id && !isRetryableBillingEventResult(existing.processing_result)) {
    return { result: "duplicate", eventType };
  }

  if (eventType !== "checkout.session.completed") {
    await supabase.from("billing_events").insert({
      stripe_event_id: stripeEventId,
      event_type: eventType,
      processing_result: "ignored",
    });
    return { result: "ignored", eventType };
  }

  const parsedGrant = buildCreditGrantFromCheckoutSession(event.data?.object);
  if (!parsedGrant.ok) {
    await supabase.from("billing_events").insert({
      stripe_event_id: stripeEventId,
      event_type: eventType,
      processing_result: "ignored",
      error_message: parsedGrant.reason,
    });
    return { result: "ignored", eventType, reason: parsedGrant.reason };
  }

  const grant = parsedGrant.grant;
  if (!grant) {
    return { result: "ignored", eventType, reason: "missing_credit_grant" };
  }

  // Self-heal the buyer's profile before the ledger FK needs it. A brand-new
  // buyer's user_profiles row is created in the same checkout action that
  // launched this payment, so it can be absent or not yet visible to this
  // connection when the webhook fires — which would fail the ledger insert and,
  // because Stripe's retry can't recreate the row from a bare UUID, lose the
  // first purchase for good. With the Clerk identity in metadata we upsert by
  // clerk_user_id and grant against the canonical id it returns. Older sessions
  // without this metadata keep the prior user_id path unchanged.
  const grantUserId = await resolveGrantUserId(supabase, grant);

  if (!existing?.id) {
    const { error: eventError } = await supabase.from("billing_events").insert({
      stripe_event_id: stripeEventId,
      event_type: eventType,
      processing_result: "received",
    });

    if (eventError) {
      if (eventError.code === "23505") {
        return { result: "duplicate", eventType };
      }
      throw new Error(`Unable to record billing event: ${eventError.message}`);
    }
  }

  const { error: ledgerError } = await supabase.from("billing_credit_ledger").insert({
    user_id: grantUserId,
    entry_type: "purchase",
    credits_delta: grant.credits,
    status: "posted",
    source: "stripe_checkout",
    stripe_event_id: stripeEventId,
    stripe_checkout_session_id: grant.checkoutSessionId || null,
    stripe_payment_intent_id: grant.paymentIntentId,
    metadata_json: {
      pack_id: grant.packId,
      amount_total: grant.amountTotal,
      currency: grant.currency,
    },
  });

  if (ledgerError) {
    if (ledgerError.code === "23505") {
      // The unique checkout-session constraint says a concurrent or earlier
      // attempt already posted these credits.
      await supabase
        .from("billing_events")
        .update({ processing_result: "granted" })
        .eq("stripe_event_id", stripeEventId);
      return { result: "duplicate", eventType };
    }
    await supabase
      .from("billing_events")
      .update({ processing_result: "failed", error_message: ledgerError.message })
      .eq("stripe_event_id", stripeEventId);
    throw new Error(`Unable to grant credits: ${ledgerError.message}`);
  }

  await supabase
    .from("billing_events")
    .update({ processing_result: "granted" })
    .eq("stripe_event_id", stripeEventId);

  return { result: "granted", eventType, credits: grant.credits, packId: grant.packId };
}
