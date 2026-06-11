"use client";

import { useActionState } from "react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleActionState } from "@/lib/action-state";
import { saveApplicationAction, saveReferenceAction } from "@/lib/actions";

type TrackerActionKind = "save" | "reference";

type NextActionTrackerFormProps = {
  jobId: string;
  matchId: string;
  label: string;
  kind: TrackerActionKind;
};

// save_to_tracker adds the job to the tracker as a saved application;
// save_reference archives it. Save as Learning Target has its own component
// (LearningTargetAction) because of its confirm-before-demote flow (US-052).
const ACTION_BY_KIND = {
  save: saveApplicationAction,
  reference: saveReferenceAction,
};

export function NextActionTrackerForm({ jobId, matchId, label, kind }: NextActionTrackerFormProps) {
  const [state, formAction] = useActionState(ACTION_BY_KIND[kind], idleActionState);

  return (
    <form action={formAction} className="grid gap-2">
      <FormSuccessPopup redirectTo={state.redirectTo} state={state} title="Tracker updated" />
      <FormStatusMessage state={state} />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="match_id" value={matchId} />
      <SubmitButton variant="outline">{label}</SubmitButton>
    </form>
  );
}
