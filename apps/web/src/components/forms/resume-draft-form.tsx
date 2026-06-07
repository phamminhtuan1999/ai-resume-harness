"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { generateResumeDraftAction } from "@/lib/actions";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";

type ResumeDraftFormProps = {
  matchId: string;
};

export function ResumeDraftForm({ matchId }: ResumeDraftFormProps) {
  const [state, formAction] = useActionState(generateResumeDraftAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Draft generated" />
      <FormStatusMessage state={state} />
      <SubmitButton pendingLabel="Generating...">Generate draft</SubmitButton>
    </form>
  );
}
