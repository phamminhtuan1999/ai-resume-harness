"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { runFullWorkflowAction } from "@/lib/actions";

type RunFullWorkflowFormProps = {
  matchId: string;
  disabled?: boolean;
  remainingSteps: number;
  totalSteps: number;
};

export function RunFullWorkflowForm({
  matchId,
  disabled = false,
  remainingSteps,
  totalSteps,
}: RunFullWorkflowFormProps) {
  const [state, formAction, isPending] = useActionState(
    runFullWorkflowAction,
    idleActionState
  );
  const router = useRouter();

  // Steps persist their run rows one by one while the action is in flight;
  // refreshing the server tree paints each row's live status as it changes.
  useEffect(() => {
    if (!isPending) {
      return;
    }
    const timer = setInterval(() => {
      router.refresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [isPending, router]);

  const allDone = remainingSteps === 0;

  return (
    <form action={formAction} className="grid gap-3">
      <FormStatusMessage state={state} successTitle="AI workflow" />
      <input type="hidden" name="match_id" value={matchId} />
      {/* Completed steps are never re-run; regenerate individual steps instead. */}
      <input type="hidden" name="force" value="false" />
      <SubmitButton
        pendingLabel="Running remaining steps..."
        disabled={disabled || allDone}
      >
        {allDone ? (
          <>
            <CheckCircle2 data-icon="inline-start" />
            All steps complete
          </>
        ) : (
          <>
            <Play data-icon="inline-start" />
            {remainingSteps === totalSteps
              ? "Run full workflow"
              : `Run ${remainingSteps} remaining step(s)`}
          </>
        )}
      </SubmitButton>
    </form>
  );
}
