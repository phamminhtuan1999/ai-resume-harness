"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import type { JobPreview } from "@/lib/actions";
import { extractJobFromDescriptionAction } from "@/lib/actions";
import {
  IntakeConfirmFields,
  IntakeSaveActions,
} from "@/components/jobs/intake-save-actions";
import {
  JobRelevancePreview,
  NonAiWarning,
} from "@/components/jobs/job-relevance-preview";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const IDLE = { status: "idle" as const, message: "" };

type JobPasteFlowProps = {
  onUseSearch: () => void;
};

/**
 * Paste JD path (US-076/077): the pasted text is run through AI extraction + the
 * AI Role Relevance check and previewed; Save / Save & Analyze (US-077) then
 * persists the job with its relevance result. The relevance result and a non-AI
 * warning appear before save; the user confirms or edits uncertain fields first.
 */
export function JobPasteFlow({ onUseSearch }: JobPasteFlowProps) {
  const [state, formAction] = useActionState(extractJobFromDescriptionAction, IDLE);

  if (state.status === "preview" && state.preview) {
    return (
      <PreviewStep
        onStartOver={() => window.location.reload()}
        onUseSearch={onUseSearch}
        preview={state.preview}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="paste-description">
          Job description
        </label>
        <Textarea
          className="min-h-52"
          id="paste-description"
          name="raw_description"
          placeholder="Paste the full job description. We'll extract the details and check AI relevance before saving."
          required
        />
        <p className="text-xs text-muted-foreground">
          We extract the title, company, skills, and requirements, then check
          whether the role fits your AI Engineer path — before anything is saved.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="paste-title">
            Job title <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input id="paste-title" name="title" placeholder="Applied AI Engineer" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="paste-company">
            Company <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input id="paste-company" name="company" placeholder="Northstar AI" />
        </div>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <div>
        <SubmitButton pendingLabel="Checking…">
          <Sparkles className="size-4" />
          Preview with AI
        </SubmitButton>
      </div>
    </form>
  );
}

function PreviewStep({
  onStartOver,
  onUseSearch,
  preview,
}: {
  onStartOver: () => void;
  onUseSearch: () => void;
  preview: JobPreview;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Review before saving</h2>
        <Button onClick={onStartOver} size="sm" type="button" variant="ghost">
          Start over
        </Button>
      </div>

      <JobRelevancePreview
        aiRelevance={preview.ai_relevance}
        relevanceAvailable={preview.relevance_available}
      />

      <NonAiWarning
        aiRelevance={preview.ai_relevance}
        onAddAnyway={() => {
          /* Non-blocking: the save action below is already shown. */
        }}
        onFindAiJobs={onUseSearch}
        relevanceAvailable={preview.relevance_available}
      />

      {preview.needs_confirmation && (
        <p className="rounded-lg border border-warning/40 bg-warning/8 px-3 py-2 text-xs text-muted-foreground">
          We couldn&apos;t confidently read the title or company. Please confirm or
          edit the fields below before saving.
        </p>
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Confirm and save</p>
        <IntakeSaveActions
          jobTitle={preview.title ?? "Pasted role"}
          mode="paste"
          payload={preview}
          saveLabel="Save job"
        >
          <IntakeConfirmFields
            defaults={{
              company: preview.company,
              title: preview.title,
              location: preview.location,
            }}
          />
        </IntakeSaveActions>
      </div>
    </div>
  );
}
