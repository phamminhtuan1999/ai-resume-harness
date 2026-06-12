import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getCreditPack } from "@/lib/billing-credits.mjs";
import { serverEnv } from "@/lib/env";

const STRIPE_API_VERSION = "2026-02-25.clover";

export class BillingConfigError extends Error {
  constructor(message = "Stripe billing is not configured.") {
    super(message);
    this.name = "BillingConfigError";
  }
}

export class StripeProviderError extends Error {
  constructor(message = "Stripe checkout failed.") {
    super(message);
    this.name = "StripeProviderError";
  }
}

type CreateCreditCheckoutSessionInput = {
  packId: string;
  userProfileId: string;
  email: string;
  origin?: string | null;
  fetchImpl?: typeof fetch;
};

function getAppOrigin(origin?: string | null) {
  return origin || serverEnv.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function createCreditCheckoutSession({
  packId,
  userProfileId,
  email,
  origin,
  fetchImpl = fetch,
}: CreateCreditCheckoutSessionInput): Promise<{ id: string; url: string }> {
  const secretKey = serverEnv.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new BillingConfigError();
  }

  const pack = getCreditPack(packId);
  if (!pack) {
    throw new StripeProviderError("Choose a valid credit pack.");
  }

  const appOrigin = getAppOrigin(origin);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", email);
  params.set("client_reference_id", userProfileId);
  params.set("success_url", `${appOrigin}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${appOrigin}/pricing`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(pack.priceCents));
  params.set("line_items[0][price_data][product_data][name]", `ApplyWise ${pack.name} credits`);
  params.set("line_items[0][price_data][product_data][description]", `${pack.credits} credits`);
  params.set("metadata[billing_kind]", "credit_pack");
  params.set("metadata[pack_id]", pack.id);
  params.set("metadata[credits]", String(pack.credits));
  params.set("metadata[user_id]", userProfileId);

  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: params,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data?.url !== "string" || typeof data?.id !== "string") {
    const message =
      typeof data?.error?.message === "string" ? data.error.message : "Stripe checkout failed.";
    throw new StripeProviderError(message);
  }

  return { id: data.id, url: data.url };
}

function parseStripeSignatureHeader(signatureHeader: string) {
  return signatureHeader.split(",").reduce(
    (parsed, part) => {
      const [key, value] = part.split("=");
      if (key === "t") {
        parsed.timestamp = value;
      }
      if (key === "v1") {
        parsed.signatures.push(value);
      }
      return parsed;
    },
    { timestamp: "", signatures: [] as string[] }
  );
}

function secureCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyStripeWebhookPayload({
  payload,
  signatureHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
}: {
  payload: string;
  signatureHeader: string | null;
  secret: string | undefined;
  nowSeconds?: number;
  toleranceSeconds?: number;
}) {
  if (!secret) {
    throw new BillingConfigError("Stripe webhook secret is not configured.");
  }
  if (!signatureHeader) {
    throw new StripeProviderError("Missing Stripe signature.");
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || signatures.length === 0) {
    throw new StripeProviderError("Invalid Stripe signature.");
  }
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    throw new StripeProviderError("Expired Stripe signature.");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const verified = signatures.some((signature) => secureCompareHex(signature, expected));
  if (!verified) {
    throw new StripeProviderError("Invalid Stripe signature.");
  }

  return JSON.parse(payload);
}
