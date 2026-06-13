"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { refreshAnalysisAction } from "@/lib/actions";
import { refreshResultBanner } from "@/lib/refresh-view.mjs";

type RefreshBilling = {
  enforced: boolean;
  cost: number;
  balance: number;
};

type RefreshAnalysisControlProps = {
  matchId: string;
  coreChainRunning: boolean;
  currentLabel: string;
  billing?: RefreshBilling;
};

// The single Refresh Analysis utility (US-050, decision 0015 §4): it is the only
// re-run control on the main surface. Refresh is asynchronous — the action posts
// and returns; AutoRefresh polls the server component tree while the core chain
// runs; on completion a result banner announces whether the verdict changed.
export function RefreshAnalysisControl({
  matchId,
  coreChainRunning,
  currentLabel,
  billing,
}: RefreshAnalysisControlProps) {
  const [state, formAction, isPending] = useActionState(refreshAnalysisAction, idleActionState);
  const [banner, setBanner] = useState<{ kind: string; message: string } | null>(null);

  const startedRef = useRef(false);
  const labelBeforeRef = useRef(currentLabel);
  const prevRunningRef = useRef(coreChainRunning);
  const wasPendingRef = useRef(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const running = coreChainRunning || isPending;

  // Decision 0020: the price is on the control, never discovered via a
  // post-hoc balance error. Unconfigured billing shows no cost vocabulary.
  const cost = billing?.cost ?? 0;
  const balance = billing?.balance ?? 0;
  const showsCost = billing?.enforced === true && cost > 0;
  const creditNoun = cost === 1 ? "credit" : "credits";
  const insufficient = showsCost && balance < cost;

  // The action firing marks the start and captures the pre-refresh verdict.
  useEffect(() => {
    if (isPending && !wasPendingRef.current) {
      startedRef.current = true;
      labelBeforeRef.current = currentLabel;
      setBanner(null);
    }
    wasPendingRef.current = isPending;
  }, [isPending, currentLabel]);

  // Completion: a refresh we started, and the core chain just went running→done.
  useEffect(() => {
    if (startedRef.current && prevRunningRef.current && !coreChainRunning) {
      setBanner(refreshResultBanner(labelBeforeRef.current, currentLabel));
      startedRef.current = false;
    }
    prevRunningRef.current = coreChainRunning;
  }, [coreChainRunning, currentLabel]);

  // Move focus to the result banner so assistive tech lands on the outcome.
  useEffect(() => {
    if (banner) {
      bannerRef.current?.focus();
    }
  }, [banner]);

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <form action={formAction}>
        <input type="hidden" name="match_id" value={matchId} />
        <Button type="submit" variant="ghost" size="sm" disabled={running || insufficient}>
          <RefreshCw data-icon="inline-start" className={running ? "animate-spin" : undefined} />
          {running
            ? "Refreshing…"
            : showsCost
              ? `Refresh analysis · ${cost} ${creditNoun}`
              : "Refresh analysis"}
        </Button>
      </form>

      {insufficient && !running ? (
        <p className="fade-in-up text-xs text-muted-foreground">
          Needs {cost} {creditNoun} — you have {balance}.{" "}
          <Link href="/pricing" className="font-medium text-brand underline-offset-4 hover:underline">
            Buy credits
          </Link>
        </p>
      ) : null}

      {running ? (
        <p role="status" aria-live="polite" className="fade-in-up text-xs text-muted-foreground">
          Refreshing your analysis… your current results stay until it finishes.
        </p>
      ) : null}

      {banner ? (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={
            banner.kind === "changed"
              ? "fade-in-up rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs font-medium"
              : "fade-in-up rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          }
        >
          {banner.message}
        </div>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="fade-in-up text-xs text-destructive">
          {state.message}
        </p>
      ) : null}

      {/* Reuses the US-038 polling primitive while the chain runs. */}
      <AutoRefresh active={coreChainRunning} />
    </div>
  );
}
