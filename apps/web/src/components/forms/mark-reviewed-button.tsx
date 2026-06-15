"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { acknowledgeWorkflowStepAction } from "@/lib/actions";

type MarkReviewedButtonProps = {
  matchId: string;
  step: string;
};

export function MarkReviewedButton({ matchId, step }: MarkReviewedButtonProps) {
  const [state, formAction, isPending] = useActionState(
    acknowledgeWorkflowStepAction,
    idleActionState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="step" value={step} />
      {state.status === "error" ? (
        <span className="text-xs text-destructive" role="alert">
          {state.message}
        </span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        <CircleCheck className={isPending ? "size-3.5 animate-pulse" : "size-3.5"} />
        {isPending ? "Saving..." : "Mark reviewed"}
      </Button>
    </form>
  );
}
