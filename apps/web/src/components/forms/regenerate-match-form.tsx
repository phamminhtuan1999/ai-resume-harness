"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { FormFieldError } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { regenerateMatchAction } from "@/lib/actions";

type RegenerateMatchFormProps = {
  matchId: string;
};

export function RegenerateMatchForm({ matchId }: RegenerateMatchFormProps) {
  const [state, formAction] = useActionState(regenerateMatchAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormStatusMessage state={state} />
      <input name="match_id" type="hidden" value={matchId} />
      <FormFieldError error={state.fieldErrors?.match_id} />
      <SubmitButton variant="outline" pendingLabel="Regenerating...">

        <RefreshCw data-icon="inline-start" />
        Regenerate analysis
      </SubmitButton>
    </form>
  );
}
