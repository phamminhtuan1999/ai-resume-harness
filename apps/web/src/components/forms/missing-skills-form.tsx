"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { FormFieldError } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { generateMissingSkillsAction } from "@/lib/actions";

type MissingSkillsFormProps = {
  matchId: string;
  hasExisting: boolean;
};

export function MissingSkillsForm({ matchId, hasExisting }: MissingSkillsFormProps) {
  const [state, formAction] = useActionState(generateMissingSkillsAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormStatusMessage state={state} />
      <input name="match_id" type="hidden" value={matchId} />
      <FormFieldError error={state.fieldErrors?.match_id} />
      <SubmitButton variant="outline" pendingLabel="Analyzing...">
        <Sparkles data-icon="inline-start" />
        {hasExisting ? "Regenerate gap analysis" : "Analyze skill gaps"}
      </SubmitButton>
    </form>
  );
}
