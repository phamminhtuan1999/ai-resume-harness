"use client";

import { useActionState, useEffect, useRef } from "react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { saveLearningTargetAction } from "@/lib/actions";

type LearningTargetActionProps = {
  jobId: string;
  matchId: string;
  label: string;
};

// "Save as Learning Target" (US-052). When the job is already in the application
// pipeline the server asks to confirm before re-statusing it (no silent
// demotion); the confirm step re-submits the same form with confirm=true.
export function LearningTargetAction({ jobId, matchId, label }: LearningTargetActionProps) {
  const [state, formAction] = useActionState(saveLearningTargetAction, idleActionState);
  const needsConfirm = state.status === "error" && state.requiresConfirm === true;

  // The confirm box replaces the focused submit button; move focus onto it so
  // keyboard and screen-reader users land on the question instead of <body>.
  const confirmRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (needsConfirm) {
      confirmRef.current?.focus();
    }
  }, [needsConfirm]);

  return (
    <form action={formAction} className="grid gap-2">
      <FormSuccessPopup redirectTo={state.redirectTo} state={state} title="Tracker updated" />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="match_id" value={matchId} />
      {needsConfirm ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          className="fade-in-up grid gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 outline-none"
        >
          <p className="text-sm">{state.message}</p>
          <input type="hidden" name="confirm" value="true" />
          <SubmitButton variant="default">Yes, save as learning target</SubmitButton>
        </div>
      ) : (
        <>
          <FormStatusMessage state={state} />
          <SubmitButton variant="outline">{label}</SubmitButton>
        </>
      )}
    </form>
  );
}
