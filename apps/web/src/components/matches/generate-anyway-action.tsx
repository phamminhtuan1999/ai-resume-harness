"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type GenerateAnywayActionProps = {
  href: string;
  label: string;
  warning: string;
};

// The material guardrail (US-049 / decision 0015 §4). For weak material
// readiness, the user sees a warning that names the actual missing skills and
// must confirm once before proceeding to the existing (unchanged, truth-guarded)
// generation surface. No new pipeline — confirm routes to the generate page.
export function GenerateAnywayAction({ href, label, warning }: GenerateAnywayActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="outline" className="w-full justify-start" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="flex items-start gap-2 text-sm leading-6">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        {warning}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="destructive" size="sm" onClick={() => router.push(href)}>
          Generate anyway
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
