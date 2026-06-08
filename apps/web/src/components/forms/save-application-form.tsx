"use client";

import { useActionState } from "react";
import { Bookmark } from "lucide-react";

import { FormFieldError, FormFieldHint } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { saveApplicationAction } from "@/lib/actions";

type SaveApplicationFormProps = {
  jobId: string;
  matchId?: string;
};

export function SaveApplicationForm({ jobId, matchId }: SaveApplicationFormProps) {
  const [state, formAction] = useActionState(saveApplicationAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormSuccessPopup redirectTo={state.redirectTo} state={state} title="Tracker updated" />
      <FormStatusMessage state={state} />
      <input name="job_id" type="hidden" value={jobId} />
      {matchId ? <input name="match_id" type="hidden" value={matchId} /> : null}
      <FormFieldHint text="Required job context is attached from this page." />
      <FormFieldError error={state.fieldErrors?.job_id || state.fieldErrors?.match_id} />
      <SubmitButton>
        <Bookmark data-icon="inline-start" />
        Save to tracker
      </SubmitButton>
    </form>
  );
}
