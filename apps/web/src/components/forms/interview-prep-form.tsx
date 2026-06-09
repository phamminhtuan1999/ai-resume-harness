"use client";

import { useActionState } from "react";

import { FormFieldError, FormFieldHint } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { generateInterviewPrepAction } from "@/lib/actions";

type InterviewPrepFormProps = {
  matchId: string;
  hasExisting?: boolean;
};

export function InterviewPrepForm({ matchId, hasExisting = false }: InterviewPrepFormProps) {
  const [state, formAction] = useActionState(generateInterviewPrepAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Interview prep generated" />
      <FormStatusMessage state={state} />
      <FormFieldHint
        text={
          hasExisting
            ? "Regenerating replaces the saved prep with a fresh set."
            : "Required match context is attached from this page."
        }
      />
      <FormFieldError error={state.fieldErrors?.match_id} />
      <SubmitButton pendingLabel="Generating...">
        {hasExisting ? "Regenerate interview prep" : "Generate interview prep"}
      </SubmitButton>
    </form>
  );
}
