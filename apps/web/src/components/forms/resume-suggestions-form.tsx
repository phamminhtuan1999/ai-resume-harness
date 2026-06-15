"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { generateResumeSuggestionsAction } from "@/lib/actions";
import { FormFieldError } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";

type ResumeSuggestionsFormProps = {
  matchId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
};

export function ResumeSuggestionsForm({
  matchId,
  label = "Generate suggestions",
  variant = "default",
}: ResumeSuggestionsFormProps) {
  const [state, formAction] = useActionState(generateResumeSuggestionsAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="match_id" value={matchId} />
      {/* Success is confirmed by the toast + the page reloading with new
          suggestions, so no persistent inline alert clutters the header. */}
      <FormSuccessPopup state={state} title="Suggestions generated" />
      <SubmitButton pendingLabel="Generating..." variant={variant}>
        {label}
      </SubmitButton>
      {state.status === "error" ? <FormStatusMessage state={state} /> : null}
      <FormFieldError error={state.fieldErrors?.match_id} />
    </form>
  );
}
