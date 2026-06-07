"use client";

import { useActionState } from "react";

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
      <SubmitButton pendingLabel="Generating...">Generate roadmap</SubmitButton>
    </form>
  );
}
