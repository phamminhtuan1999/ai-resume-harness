"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { generateDashboardSummaryAction } from "@/lib/actions";

type DashboardSummaryFormProps = {
  hasExisting: boolean;
};

export function DashboardSummaryForm({ hasExisting }: DashboardSummaryFormProps) {
  const [state, formAction] = useActionState(generateDashboardSummaryAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormStatusMessage state={state} />
      <input name="regenerate" type="hidden" value={hasExisting ? "true" : "false"} />
      <SubmitButton variant="outline" pendingLabel="Analyzing your job search...">
        <Sparkles data-icon="inline-start" />
        {hasExisting ? "Regenerate summary" : "Generate summary"}
      </SubmitButton>
    </form>
  );
}
