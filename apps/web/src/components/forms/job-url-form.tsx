"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { importJobByUrlAction } from "@/lib/actions";
import { FormField } from "@/components/forms/form-field";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type JobUrlFormProps = {
  url: string;
  onUrlChange: (value: string) => void;
  onUseManual: () => void;
};

export function JobUrlForm({ url, onUrlChange, onUseManual }: JobUrlFormProps) {
  const [state, formAction] = useActionState(importJobByUrlAction, idleActionState);
  const failed = state.status === "error";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormSuccessPopup
        redirectTo={state.status === "success" ? state.redirectTo : undefined}
        state={state}
        title="Job imported"
      />
      <FormField
        error={state.fieldErrors?.source_url}
        helpText="Paste a job posting link. We fetch the page and fill in the details for you."
        label="Job URL"
        required
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.source_url)}
          inputMode="url"
          name="source_url"
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://boards.greenhouse.io/acme/jobs/123"
          required
          type="url"
          value={url}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Fetching...">Fetch and save</SubmitButton>
        {failed ? (
          <Button onClick={onUseManual} type="button" variant="outline">
            Paste the description manually
          </Button>
        ) : null}
      </div>
    </form>
  );
}
