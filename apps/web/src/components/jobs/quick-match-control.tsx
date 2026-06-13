"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { quickMatchAction, type QuickMatchActionResult } from "@/lib/actions";

type QuickMatchControlProps = {
  jobId: string;
};

// US-068: the explicit, per-job "AI quick match" action on the jobs list. It is
// opt-in (never auto-run for every row), uses the fast model tier, and renders a
// short likelihood + one-line reason — deliberately a preview, with a link to the
// real analysis. If the model is unavailable the deterministic fallback still
// returns a usable preview; a transport/auth failure shows a friendly retry.
const LIKELIHOOD_LABEL = {
  strong: "Likely a strong fit",
  promising: "Possibly a fit",
  weak: "Probably a long shot",
} as const;

const LIKELIHOOD_DOT = {
  strong: "bg-success",
  promising: "bg-warning",
  weak: "bg-muted-foreground/50",
} as const;

export function QuickMatchControl({ jobId }: QuickMatchControlProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<QuickMatchActionResult | null>(null);

  const run = () => {
    startTransition(async () => {
      setResult(await quickMatchAction(jobId));
    });
  };

  if (pending) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Sparkles data-icon="inline-start" className="animate-pulse" />
        Reading the fit…
      </span>
    );
  }

  if (result?.ok) {
    return (
      <span className="fade-in-up inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <span className={`size-1.5 rounded-full ${LIKELIHOOD_DOT[result.likelihood]}`} aria-hidden />
          {LIKELIHOOD_LABEL[result.likelihood]}
        </span>
        {result.headline ? (
          <span className="max-w-[16rem] text-xs text-muted-foreground">{result.headline}</span>
        ) : null}
        <Link
          href={`/jobs/${jobId}`}
          className="text-xs font-medium text-brand underline-offset-4 hover:underline"
        >
          Run full analysis
        </Link>
      </span>
    );
  }

  if (result && !result.ok) {
    return (
      <span className="fade-in-up inline-flex flex-col items-start gap-0.5">
        <span role="alert" className="text-xs text-muted-foreground">
          {result.message}
        </span>
        {result.retryable ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={run}
          >
            Try again
          </Button>
        ) : null}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto px-2 py-1 text-xs text-muted-foreground"
      onClick={run}
    >
      <Sparkles data-icon="inline-start" />
      AI quick match
    </Button>
  );
}
