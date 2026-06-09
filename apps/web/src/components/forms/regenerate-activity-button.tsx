"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { regenerateActivityDescriptionAction } from "@/lib/actions";

type RegenerateActivityButtonProps = {
  activityId: string;
};

export function RegenerateActivityButton({ activityId }: RegenerateActivityButtonProps) {
  const [state, formAction, isPending] = useActionState(
    regenerateActivityDescriptionAction,
    idleActionState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="activity_id" value={activityId} />
      {state.status === "error" ? (
        <span className="text-xs text-destructive" role="alert">
          {state.message}
        </span>
      ) : null}
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={isPending}
        aria-label="Refresh description"
        title="Refresh description"
      >
        <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
      </Button>
    </form>
  );
}
