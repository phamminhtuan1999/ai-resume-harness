"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  APPLICATION_STATUSES,
  getApplicationStatusLabel,
} from "@/lib/application-tracker.mjs";
import { idleActionState } from "@/lib/action-state";
import { updateApplicationStatusAction } from "@/lib/actions";

type ApplicationStatusFormProps = {
  applicationId: string;
  status: string;
};

export function ApplicationStatusForm({ applicationId, status }: ApplicationStatusFormProps) {
  const [state, formAction] = useActionState(updateApplicationStatusAction, idleActionState);

  return (
    <form action={formAction} className="grid min-w-[220px] gap-2">
      <FormSuccessPopup state={state} title="Status updated" />
      <input name="application_id" type="hidden" value={applicationId} />
      <label className="sr-only" htmlFor={`application-status-${applicationId}`}>
        Application status
      </label>
      <div className="flex gap-2">
        <select
          className="h-8 flex-1 rounded-lg border bg-background px-2 text-sm"
          defaultValue={status}
          id={`application-status-${applicationId}`}
          name="status"
          required
        >
          {APPLICATION_STATUSES.map((option) => (
            <option key={option} value={option}>
              {getApplicationStatusLabel(option)}
            </option>
          ))}
        </select>
        <SubmitButton className="w-fit" variant="outline">
          <Save data-icon="inline-start" />
          Update
        </SubmitButton>
      </div>
      <FormStatusMessage state={state} successTitle="Updated" />
    </form>
  );
}
