"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Re-runs the success page's server render while Stripe confirms the payment,
// so "Finalizing…" flips to "Payment received" without the buyer babysitting
// the tab. Bounded: most confirmations land in seconds, and the page's own
// escape-hatch copy covers the case where polling gives up.
export function PendingPaymentRefresh({
  intervalMs = 4000,
  maxAttempts = 15,
}: {
  intervalMs?: number;
  maxAttempts?: number;
}) {
  const router = useRouter();
  const attemptsRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      attemptsRef.current += 1;
      if (attemptsRef.current > maxAttempts) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, maxAttempts, router]);

  return null;
}
