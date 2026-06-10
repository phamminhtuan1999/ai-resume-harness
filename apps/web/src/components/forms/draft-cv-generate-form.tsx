"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { generateDraftCvAction } from "@/lib/actions";
import { FormFieldHint } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";

type DraftCvGenerateFormProps = {
  matchId: string;
  hasDraft: boolean;
};

export function DraftCvGenerateForm({ matchId, hasDraft }: DraftCvGenerateFormProps) {
  const [state, formAction] = useActionState(generateDraftCvAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Draft CV generated" />
      <FormStatusMessage state={state} />
      <FormFieldHint
        text={
          hasDraft
            ? "Regenerating creates a new version. Earlier versions are kept."
            : "Generation uses your resume, profile, and the analyzed job."
        }
      />
      <SubmitButton pendingLabel={hasDraft ? "Regenerating..." : "Generating..."}>
        {hasDraft ? "Regenerate draft CV" : "Generate draft CV"}
      </SubmitButton>
    </form>
  );
}
