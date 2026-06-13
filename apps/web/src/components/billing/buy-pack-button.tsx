"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";

type BuyPackButtonProps = {
  label: string;
  disabled?: boolean;
};

// GET /pricing stays outside the Clerk proxy, so auth state resolves
// client-side (same contract as MarketingAuthNav). The button renders active
// from first paint: pre-hydration a click runs the server action, which safely
// bounces a signed-out visitor to /sign-in?redirect_url=/pricing — honest, no
// dead-looking greyed CTA at the buy moment. Once Clerk confirms signed-out, we
// swap to an explicit "Sign in to buy" link so the intent is clear up front.
export function BuyPackButton({ label, disabled }: BuyPackButtonProps) {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && !isSignedIn) {
    return (
      <Link
        href="/sign-in?redirect_url=%2Fpricing"
        className={buttonVariants({ variant: "outline" })}
      >
        Sign in to buy
      </Link>
    );
  }

  return (
    <SubmitButton disabled={disabled} pendingLabel="Opening Stripe checkout…">
      {label}
    </SubmitButton>
  );
}
