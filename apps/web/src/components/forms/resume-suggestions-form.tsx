"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { generateResumeSuggestionsAction } from "@/lib/actions";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";

type ResumeSuggestionsFormProps = {
  matchId: string;
};

export function ResumeSuggestionsForm({ matchId }: ResumeSuggestionsFormProps) {
  const [state, formAction] = useActionState(generateResumeSuggestionsAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Suggestions generated" />
      <FormStatusMessage state={state} />
      <SubmitButton pendingLabel="Generating...">Generate suggestions</SubmitButton>
    </form>
  );
}
