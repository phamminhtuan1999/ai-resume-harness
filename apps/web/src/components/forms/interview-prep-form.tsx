"use client";

import { useActionState } from "react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { generateInterviewPrepAction } from "@/lib/actions";

type InterviewPrepFormProps = {
  matchId: string;
};

export function InterviewPrepForm({ matchId }: InterviewPrepFormProps) {
  const [state, formAction] = useActionState(generateInterviewPrepAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Interview prep generated" />
      <FormStatusMessage state={state} />
      <SubmitButton pendingLabel="Generating...">Generate interview prep</SubmitButton>
    </form>
  );
}
