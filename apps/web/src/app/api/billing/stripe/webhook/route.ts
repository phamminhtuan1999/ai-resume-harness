import { NextResponse } from "next/server";

import { processStripeBillingEvent } from "@/lib/billing-ledger";
import {
  BillingConfigError,
  StripeProviderError,
  verifyStripeWebhookPayload,
} from "@/lib/billing-stripe";
import { serverEnv } from "@/lib/env";

export async function POST(request: Request) {
  const payload = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  let event: Parameters<typeof processStripeBillingEvent>[0];
  try {
    event = verifyStripeWebhookPayload({
      payload,
      signatureHeader,
      secret: serverEnv.STRIPE_WEBHOOK_SECRET,
    }) as Parameters<typeof processStripeBillingEvent>[0];
  } catch (error) {
    const status = error instanceof BillingConfigError ? 503 : 400;
    const message =
      error instanceof BillingConfigError || error instanceof StripeProviderError
        ? error.message
        : "Invalid Stripe webhook.";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const result = await processStripeBillingEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing webhook failed.";
    console.warn("[ApplyWise billing] webhook failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
