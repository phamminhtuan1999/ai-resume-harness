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
  | { ok: true; userProfileId: string; clerkUserId: string; email: string; hasResume: boolean }
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

  // Credits are only spendable on resume × job workflows, so a buyer with no
  // resume yet has nothing to spend on. We surface that as a gate below rather
  // than taking a payment for an unusable balance.
  const { count: resumeCount } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.id);

  return {
    ok: true,
    userProfileId: data.id,
    clerkUserId: appUser.clerkUserId,
    email: appUser.email,
    hasResume: (resumeCount ?? 0) > 0,
  };
}

export async function startCreditCheckoutAction(formData: FormData) {
  const context = await requireBillingUserProfile();
  if (!context.ok) {
    // Send the buyer back to pricing after auth so the purchase context
    // (and their pack choice) is one click away instead of lost.
    redirect("/sign-in?redirect_url=%2Fpricing");
  }

  if (!context.hasResume) {
    // A brand-new buyer with no resume has nothing to spend credits on yet, and
    // their profile row is only just created. Route them into the resume import
    // flow (which also completes their profile) before any payment, instead of
    // selling an unusable balance.
    redirect("/resumes/new?from=buy-credits");
  }

  const packId = String(formData.get("pack_id") || "");
  const requestHeaders = await headers();

  try {
    const checkout = await createCreditCheckoutSession({
      packId,
      userProfileId: context.userProfileId,
      clerkUserId: context.clerkUserId,
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
