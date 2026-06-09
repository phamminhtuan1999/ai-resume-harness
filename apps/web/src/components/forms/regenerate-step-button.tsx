"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { regenerateWorkflowStepAction } from "@/lib/actions";

type RegenerateStepButtonProps = {
  matchId: string;
  step: string;
  label: string;
};

export function RegenerateStepButton({ matchId, step, label }: RegenerateStepButtonProps) {
  const [state, formAction, isPending] = useActionState(
    regenerateWorkflowStepAction,
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
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        <RefreshCw className={isPending ? "size-3.5 animate-spin" : "size-3.5"} />
        {isPending ? "Running..." : label}
      </Button>
    </form>
  );
}
