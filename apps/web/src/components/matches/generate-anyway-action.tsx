"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type GenerateAnywayActionProps = {
  href: string;
  label: string;
  warning: string;
  credits?: number | null;
};

// The material guardrail (US-049 / decision 0015 §4). For weak material
// readiness, the user sees a warning that names the actual missing skills and
// must confirm once before proceeding to the existing (unchanged, truth-guarded)
// generation surface. No new pipeline — confirm routes to the generate page.
export function GenerateAnywayAction({ href, label, warning, credits }: GenerateAnywayActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  // Swapping the focused trigger for the warning box would otherwise drop
  // focus to <body> and leave assistive tech unaware anything happened.
  const warningRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasConfirmingRef = useRef(false);

  useEffect(() => {
    if (confirming) {
      wasConfirmingRef.current = true;
      warningRef.current?.focus();
    } else if (wasConfirmingRef.current) {
      triggerRef.current?.focus();
    }
  }, [confirming]);

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        variant="outline"
        className="w-full justify-start"
        onClick={() => setConfirming(true)}
      >
        {label}
        {credits ? (
          <span className="ml-auto pl-3 text-xs font-normal opacity-75 tabular-nums">
            {credits} {credits === 1 ? "credit" : "credits"}
          </span>
        ) : null}
      </Button>
    );
  }

  return (
    <div
      ref={warningRef}
      tabIndex={-1}
      className="fade-in-up rounded-lg border border-warning/40 bg-warning/10 p-3 outline-none"
    >
      <p className="flex items-start gap-2 text-sm leading-6">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        {warning}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Warning, not destructive: spending credits on a stretch role is
            cautionary, never ruinous — and the cost stays disclosed at the
            commit point, not just on the trigger (decision 0020). */}
        <Button variant="warning" size="sm" onClick={() => router.push(href)}>
          Generate anyway
          {credits ? (
            <span className="text-xs font-normal tabular-nums">
              · {credits} {credits === 1 ? "credit" : "credits"}
            </span>
          ) : null}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
