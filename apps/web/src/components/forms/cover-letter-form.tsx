"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { FormFieldError } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { generateCoverLetterAction } from "@/lib/actions";

type CoverLetterFormProps = {
  matchId: string;
  hasExisting: boolean;
};

export function CoverLetterForm({ matchId, hasExisting }: CoverLetterFormProps) {
  const [state, formAction] = useActionState(generateCoverLetterAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormStatusMessage state={state} />
      <input name="match_id" type="hidden" value={matchId} />
      <FormFieldError error={state.fieldErrors?.match_id} />
      <SubmitButton pendingLabel="Writing...">
        <Sparkles data-icon="inline-start" />
        {hasExisting ? "Regenerate cover letter" : "Generate cover letter"}
      </SubmitButton>
    </form>
  );
}
