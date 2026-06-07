"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { generateMatchAction } from "@/lib/actions";
import type { WorkspaceJob, WorkspaceResume } from "@/lib/data/server";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";

type MatchFormProps = {
  jobs: WorkspaceJob[];
  resumes: WorkspaceResume[];
};

export function MatchForm({ jobs, resumes }: MatchFormProps) {
  const [state, formAction] = useActionState(generateMatchAction, idleActionState);
  const canGenerate = resumes.length > 0 && jobs.length > 0;

  return (
    <form action={formAction} className="grid gap-4">
      <FormSuccessPopup redirectTo={state.redirectTo} state={state} title="Match generated" />
      <FormStatusMessage state={state} />

      <label className="flex flex-col gap-2 text-sm font-medium">
        Resume
        <select
          className="h-10 rounded-lg border bg-background px-3 text-sm"
          name="resume_id"
          required
        >
          <option value="">Choose a resume</option>
          {resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Job
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" name="job_id" required>
          <option value="">Choose a job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.company} - {job.title}
            </option>
          ))}
        </select>
      </label>

      {!canGenerate ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add at least one resume and one job before generating a match.
        </div>
      ) : null}

      <SubmitButton disabled={!canGenerate}>Generate analysis</SubmitButton>
    </form>
  );
}
