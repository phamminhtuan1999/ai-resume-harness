"use client";

import { useActionState } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { idleActionState } from "@/lib/action-state";
import { updateJobAction, updateResumeAction } from "@/lib/actions";

type EditRecordDialogProps = {
  kind: "resume" | "job";
  recordId: string;
  title: string;
  company?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Lightweight rename modal (US-058). Edits only the safe display fields —
// job: title + company; resume: title — leaving canonical parsed content
// untouched. On success the server action redirects with a flash code; field
// errors keep the dialog open. Inputs are uncontrolled, so a failed submit
// preserves what the user typed.
export function EditRecordDialog({
  kind,
  recordId,
  title,
  company,
  open,
  onOpenChange,
}: EditRecordDialogProps) {
  const action = kind === "resume" ? updateResumeAction : updateJobAction;
  const idName = kind === "resume" ? "resume_id" : "job_id";
  const [state, formAction] = useActionState(action, idleActionState);
  const hasFieldErrors = Boolean(state.fieldErrors && Object.keys(state.fieldErrors).length > 0);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Edit {kind}</AlertDialogTitle>
        <AlertDialogDescription>
          {kind === "job"
            ? "Update the role title and company. The parsed description is unchanged."
            : "Rename this resume. The canonical resume text is unchanged."}
        </AlertDialogDescription>
        <form action={formAction} className="mt-4 grid gap-4">
          <input type="hidden" name={idName} value={recordId} />
          <FormField
            label={kind === "job" ? "Role title" : "Resume title"}
            error={state.fieldErrors?.title}
            required
          >
            <Input
              name="title"
              defaultValue={title}
              aria-invalid={Boolean(state.fieldErrors?.title)}
              autoFocus
              required
            />
          </FormField>
          {kind === "job" ? (
            <FormField label="Company" error={state.fieldErrors?.company} required>
              <Input
                name="company"
                defaultValue={company ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.company)}
                required
              />
            </FormField>
          ) : null}
          {state.status === "error" && !hasFieldErrors ? <FormStatusMessage state={state} /> : null}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="ghost" size="sm" />}>
              Cancel
            </AlertDialogClose>
            <SubmitButton size="sm">Save changes</SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
