"use client";

import { useActionState } from "react";

import { FormFieldError, FormFieldHint } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { generateRoadmapAction } from "@/lib/actions";

type RoadmapFormProps = {
  matchId: string;
  hasExisting?: boolean;
};

export function RoadmapForm({ matchId, hasExisting = false }: RoadmapFormProps) {
  const [state, formAction] = useActionState(generateRoadmapAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Roadmap generated" />
      <FormStatusMessage state={state} />
      <FormFieldHint
        text={
          hasExisting
            ? "Regenerating replaces the saved roadmap with a fresh plan."
            : "Required match context is attached from this page."
        }
      />
      <FormFieldError error={state.fieldErrors?.match_id} />
      <SubmitButton pendingLabel="Generating...">
        {hasExisting ? "Regenerate roadmap" : "Generate roadmap"}
      </SubmitButton>
    </form>
  );
}
