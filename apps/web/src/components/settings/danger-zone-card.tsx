"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { DetailsSection } from "@/components/ui/details-section";
import { Input } from "@/components/ui/input";
import { idleActionState } from "@/lib/action-state";
import { deleteAccountAction } from "@/lib/actions";
import { DELETION_CONFIRM_PHRASE, isDeletionConfirmed } from "@/lib/deletion-view.mjs";

type DangerZoneCardProps = {
  recordCount: number;
};

// US-056 / decision 0016: full account erasure. Typed-DELETE confirmation gates
// the destructive button; the server re-validates the phrase, purges all data,
// then deletes the Clerk sign-in and redirects to the public landing page.
//
// Collapsed by default: settings is a routine surface and the erase-everything
// flow shouldn't sit open next to it. Expanding is the first of the two
// deliberate steps (open, then type the phrase) before the button arms.
export function DangerZoneCard({ recordCount }: DangerZoneCardProps) {
  const [state, formAction] = useActionState(deleteAccountAction, idleActionState);
  const [confirmText, setConfirmText] = useState("");
  const armed = isDeletionConfirmed(confirmText);

  return (
    <DetailsSection
      variant="card"
      className="border-destructive/40"
      summary={
        <span className="flex items-center gap-2 text-destructive">
          <TriangleAlert className="size-4" />
          Delete account
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Permanently deletes your {recordCount} saved record{recordCount === 1 ? "" : "s"} and your
          sign-in account. This erases everything and cannot be undone.
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <FormStatusMessage state={state} />
          <label className="text-sm font-medium" htmlFor="confirm_text">
            Type <span className="font-mono">{DELETION_CONFIRM_PHRASE}</span> to confirm
          </label>
          <Input
            id="confirm_text"
            name="confirm_text"
            autoComplete="off"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.confirm_text)}
            className="max-w-xs"
          />
          <div>
            <SubmitButton variant="destructive" disabled={!armed} pendingLabel="Deleting account...">
              Delete my account
            </SubmitButton>
          </div>
        </form>
      </div>
    </DetailsSection>
  );
}
