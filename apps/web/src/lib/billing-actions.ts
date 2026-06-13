"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentAppUser } from "@/lib/auth/server";
import {
  BillingConfigError,
  createCreditCheckoutSession,
  StripeProviderError,
} from "@/lib/billing-stripe";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

async function requireBillingUserProfile(): Promise<
  | { ok: true; userProfileId: string; email: string }
  | { ok: false }
> {
  const appUser = await getCurrentAppUser();
  if (!appUser || !hasSupabaseEnv()) {
    return { ok: false };
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        clerk_user_id: appUser.clerkUserId,
        email: appUser.email,
        full_name: appUser.fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false };
  }

  return { ok: true, userProfileId: data.id, email: appUser.email };
}

export async function startCreditCheckoutAction(formData: FormData) {
  const context = await requireBillingUserProfile();
  if (!context.ok) {
    // Send the buyer back to pricing after auth so the purchase context
    // (and their pack choice) is one click away instead of lost.
    redirect("/sign-in?redirect_url=%2Fpricing");
  }

  const packId = String(formData.get("pack_id") || "");
  const requestHeaders = await headers();

  try {
    const checkout = await createCreditCheckoutSession({
      packId,
      userProfileId: context.userProfileId,
      email: context.email,
      origin: requestHeaders.get("origin"),
    });
    redirect(checkout.url);
  } catch (error) {
    if (error instanceof BillingConfigError) {
      redirect("/pricing?billing=setup-pending");
    }
    if (error instanceof StripeProviderError) {
      redirect("/pricing?billing=checkout-error");
    }
    throw error;
  }
}
