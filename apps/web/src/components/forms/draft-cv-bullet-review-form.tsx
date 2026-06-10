"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { buttonVariants } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { updateDraftCvBulletAction } from "@/lib/actions";

type DraftCvBulletReviewFormProps = {
  matchId: string;
  draftCvId: string;
  bulletId: string;
  userAction: string;
};

export function DraftCvBulletReviewForm({
  matchId,
  draftCvId,
  bulletId,
  userAction,
}: DraftCvBulletReviewFormProps) {
  const [state, formAction] = useActionState(updateDraftCvBulletAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-2">
      <FormStatusMessage state={state} />
      <input type="hidden" name="draft_cv_id" value={draftCvId} />
      <input type="hidden" name="bullet_id" value={bulletId} />
      <input type="hidden" name="match_id" value={matchId} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="user_action"
          value="approved"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <Check data-icon="inline-start" />
          {userAction === "approved" ? "Approved" : "Approve"}
        </button>
        <button
          type="submit"
          name="user_action"
          value="rejected"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <X data-icon="inline-start" />
          {userAction === "rejected" ? "Rejected" : "Reject"}
        </button>
        {userAction && userAction !== "pending" ? (
          <span className="text-xs font-medium text-muted-foreground">
            Status: {userAction}
          </span>
        ) : null}
      </div>
    </form>
  );
}
