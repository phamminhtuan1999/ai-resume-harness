"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { FormFieldError, FormFieldHint } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Select } from "@/components/ui/select";
import {
  APPLICATION_STATUSES,
  getApplicationStatusLabel,
} from "@/lib/application-tracker.mjs";
import { valuesDiffer } from "@/lib/form-dirty.mjs";
import { idleActionState } from "@/lib/action-state";
import { updateApplicationStatusAction } from "@/lib/actions";

type ApplicationStatusFormProps = {
  applicationId: string;
  status: string;
};

export function ApplicationStatusForm({ applicationId, status }: ApplicationStatusFormProps) {
  const [state, formAction] = useActionState(updateApplicationStatusAction, idleActionState);
  const [selected, setSelected] = useState(status);
  const [savedStatus, setSavedStatus] = useState(status);

  // When the saved status changes (e.g. after a successful update revalidates the
  // tracker), re-sync the selection so the control returns to a clean state. A
  // failed update leaves the saved status unchanged, keeping the edit and Update
  // enabled for retry. This render-time adjustment is preferred over an effect.
  if (savedStatus !== status) {
    setSavedStatus(status);
    setSelected(status);
  }

  const isDirty = valuesDiffer({ status }, { status: selected });

  return (
    <form action={formAction} className="grid min-w-[220px] gap-2">
      <FormSuccessPopup state={state} title="Status updated" />
      <input name="application_id" type="hidden" value={applicationId} />
      <label className="sr-only" htmlFor={`application-status-${applicationId}`}>
        Application status
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select
            aria-invalid={Boolean(state.fieldErrors?.status)}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            id={`application-status-${applicationId}`}
            name="status"
            required
          >
            {APPLICATION_STATUSES.map((option) => (
              <option key={option} value={option}>
                {getApplicationStatusLabel(option)}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton className="w-fit" variant="outline" disabled={!isDirty}>
          <Save data-icon="inline-start" />
          Update
        </SubmitButton>
      </div>
      <FormFieldHint text="Required. Pick the current tracker stage." />
      <FormFieldError error={state.fieldErrors?.application_id || state.fieldErrors?.status} />
      <FormStatusMessage state={state} successTitle="Updated" />
    </form>
  );
}
