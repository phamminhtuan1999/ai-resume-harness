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
};

export function RoadmapForm({ matchId }: RoadmapFormProps) {
  const [state, formAction] = useActionState(generateRoadmapAction, idleActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="match_id" value={matchId} />
      <FormSuccessPopup state={state} title="Roadmap generated" />
      <FormStatusMessage state={state} />
      <FormFieldHint text="Required match context is attached from this page." />
      <FormFieldError error={state.fieldErrors?.match_id} />
      <SubmitButton pendingLabel="Generating...">Generate roadmap</SubmitButton>
    </form>
  );
}
