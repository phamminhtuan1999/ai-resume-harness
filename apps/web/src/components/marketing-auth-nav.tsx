"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

import { buttonVariants } from "@/components/ui/button";

// Signed-out links double as the no-Clerk-env fallback, so they must not
// touch Clerk hooks.
export function MarketingAuthLinks() {
  return (
    <>
      <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className={buttonVariants({ className: "hidden sm:inline-flex" })}
      >
        Start workspace
      </Link>
    </>
  );
}

// Public marketing pages render outside the Clerk proxy, so the server cannot
// read the session; Clerk resolves it client-side after hydration.
export function MarketingAuthNav() {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && isSignedIn) {
    return (
      <Link href="/dashboard" className={buttonVariants()}>
        Open dashboard
      </Link>
    );
  }

  return <MarketingAuthLinks />;
}
