"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { deleteJobAction, deleteResumeAction } from "@/lib/actions";

type DeleteRecordDialogProps = {
  kind: "resume" | "job";
  recordId: string;
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// The destructive confirm modal (US-058). On success the server action
// redirects to the list with a flash code, so there is no client success state
// to handle here; only a validation/ownership error keeps the dialog open.
export function DeleteRecordDialog({
  kind,
  recordId,
  summary,
  open,
  onOpenChange,
}: DeleteRecordDialogProps) {
  const action = kind === "resume" ? deleteResumeAction : deleteJobAction;
  const idName = kind === "resume" ? "resume_id" : "job_id";
  const [state, formAction] = useActionState(action, idleActionState);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <TriangleAlert className="size-4" />
          </span>
          <div className="min-w-0">
            <AlertDialogTitle>Delete {kind}?</AlertDialogTitle>
            <AlertDialogDescription>{summary}</AlertDialogDescription>
          </div>
        </div>
        <form action={formAction}>
          <input type="hidden" name={idName} value={recordId} />
          {state.status === "error" ? (
            <div className="mt-4">
              <FormStatusMessage state={state} />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="ghost" size="sm" />}>
              Cancel
            </AlertDialogClose>
            <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting...">
              Delete permanently
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
