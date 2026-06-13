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
// client-side (same contract as MarketingAuthNav). Signed-out visitors get an
// honest "Sign in to buy" link instead of a submit that silently bounces.
// Until Clerk loads, the button shows its final label but stays disabled —
// an affordance may strengthen on hydration, never appear-then-revoke.
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
    <SubmitButton disabled={disabled || !isLoaded} pendingLabel="Opening Stripe checkout…">
      {label}
    </SubmitButton>
  );
}
