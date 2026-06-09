"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { buttonVariants } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { updateSuggestionAction } from "@/lib/actions";

type SuggestionReviewFormProps = {
  matchId: string;
  suggestionId: string;
  suggestedText: string;
  userAction: string;
};

export function SuggestionReviewForm({
  matchId,
  suggestionId,
  suggestedText,
  userAction,
}: SuggestionReviewFormProps) {
  const [state, formAction] = useActionState(updateSuggestionAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-2">
      <FormStatusMessage state={state} />
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <input type="hidden" name="match_id" value={matchId} />
      <textarea
        name="suggested_text"
        defaultValue={suggestedText}
        rows={3}
        aria-label="Edit suggested resume text"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-6 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="user_action"
          value="accepted"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <Check data-icon="inline-start" />
          {userAction === "accepted" ? "Save edit" : "Accept"}
        </button>
        <button
          type="submit"
          name="user_action"
          value="rejected"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <X data-icon="inline-start" />
          Reject
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
