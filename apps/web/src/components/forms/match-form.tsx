"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { generateMatchAction } from "@/lib/actions";
import type { WorkspaceJob, WorkspaceResume } from "@/lib/data/server";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Select } from "@/components/ui/select";

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

      <FormField
        error={state.fieldErrors?.resume_id}
        helpText="Required. Choose the resume to compare against the job."
        label="Resume"
        required
      >
        <Select
          aria-invalid={Boolean(state.fieldErrors?.resume_id)}
          disabled={resumes.length === 0}
          name="resume_id"
          required
        >
          <option value="">Choose a resume</option>
          {resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.title}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        error={state.fieldErrors?.job_id}
        helpText="Required. Choose the job description to analyze."
        label="Job"
        required
      >
        <Select
          aria-invalid={Boolean(state.fieldErrors?.job_id)}
          disabled={jobs.length === 0}
          name="job_id"
          required
        >
          <option value="">Choose a job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.company} - {job.title}
            </option>
          ))}
        </Select>
      </FormField>

      {!canGenerate ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add at least one resume and one job before generating a match.
        </div>
      ) : null}

      <SubmitButton disabled={!canGenerate}>Generate analysis</SubmitButton>
    </form>
  );
}
