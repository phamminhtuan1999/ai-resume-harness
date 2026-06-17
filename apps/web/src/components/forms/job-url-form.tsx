"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { JobPreview } from "@/lib/actions";
import { idleActionState } from "@/lib/action-state";
import { importJobByUrlAction, previewJobUrlAction } from "@/lib/actions";
import {
  JobRelevancePreview,
  NonAiWarning,
} from "@/components/jobs/job-relevance-preview";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type JobUrlFormProps = {
  url: string;
  onUrlChange: (value: string) => void;
  onUseManual: () => void;
  onUseSearch?: () => void;
};

const PREVIEW_IDLE = { status: "idle" as const, message: "" };

/**
 * URL import (US-076): fetch + extract + score relevance WITHOUT saving, then
 * preview the role and its AI relevance before the user commits. On a
 * fetch/extract failure the user is offered the manual-paste fallback. Save
 * itself reuses the existing import-url save path (US-077 splits Save Only /
 * Save & Analyze / Open Apply + activity events).
 */
export function JobUrlForm({
  url,
  onUrlChange,
  onUseManual,
  onUseSearch,
}: JobUrlFormProps) {
  const [previewState, previewAction] = useActionState(previewJobUrlAction, PREVIEW_IDLE);

  if (previewState.status === "preview" && previewState.preview) {
    return (
      <UrlPreviewStep
        onCancel={() => window.location.reload()}
        onUseManual={onUseManual}
        onUseSearch={onUseSearch}
        preview={previewState.preview}
        url={url}
      />
    );
  }

  const failed = previewState.status === "error";

  return (
    <form action={previewAction} className="flex flex-col gap-4">
      <FormField
        error={failed ? previewState.message : undefined}
        helpText="Paste a job posting link. We fetch the page and check AI relevance before you save."
        label="Job URL"
        required
      >
        <Input
          aria-invalid={failed}
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
        <SubmitButton pendingLabel="Fetching…">Preview job</SubmitButton>
        {failed ? (
          <Button onClick={onUseManual} type="button" variant="outline">
            Paste the description manually
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function UrlPreviewStep({
  onCancel,
  onUseManual,
  onUseSearch,
  preview,
  url,
}: {
  onCancel: () => void;
  onUseManual: () => void;
  onUseSearch?: () => void;
  preview: JobPreview;
  url: string;
}) {
  const [saveState, saveAction] = useActionState(importJobByUrlAction, idleActionState);

  if (preview.duplicate && preview.duplicate_job_id) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          You&apos;ve already saved <strong>{preview.title ?? "this job"}</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants()} href={`/jobs/${preview.duplicate_job_id}`}>
            Open saved job
          </Link>
          <Button onClick={onCancel} type="button" variant="outline">
            Preview another URL
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <FormSuccessPopup
        redirectTo={saveState.status === "success" ? saveState.redirectTo : undefined}
        state={saveState}
        title="Job saved"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">{preview.title ?? "Imported role"}</h2>
          <p className="text-xs text-muted-foreground">
            {[preview.company, preview.location].filter(Boolean).join(" · ") ||
              "Review before saving"}
          </p>
        </div>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>

      <JobRelevancePreview
        aiRelevance={preview.ai_relevance}
        relevanceAvailable={preview.relevance_available}
      />

      <NonAiWarning
        aiRelevance={preview.ai_relevance}
        onAddAnyway={() => {
          /* Non-blocking: the Save action below stays available. */
        }}
        onFindAiJobs={onUseSearch ?? onUseManual}
        relevanceAvailable={preview.relevance_available}
      />

      {preview.needs_confirmation && (
        <p className="rounded-lg border border-warning/40 bg-warning/8 px-3 py-2 text-xs text-muted-foreground">
          We couldn&apos;t confidently read the title or company. You can save and
          edit it afterward, or paste the description manually for a cleaner read.
        </p>
      )}

      <Separator />

      {/* Save reuses the existing import-url save path (US-077 evolves this). */}
      <form action={saveAction} className="flex flex-col gap-3">
        <FormStatusMessage state={saveState} />
        <input name="source_url" type="hidden" value={url} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving…">Save job</SubmitButton>
          <Button onClick={onUseManual} type="button" variant="outline">
            Edit manually instead
          </Button>
        </div>
      </form>
    </div>
  );
}
