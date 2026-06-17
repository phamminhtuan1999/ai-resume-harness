"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { saveJobAction } from "@/lib/actions";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type JobFormDefaults = {
  company?: string;
  title?: string;
  location?: string;
  rawDescription?: string;
};

export function JobForm({
  defaultJobUrl = "",
  defaults,
}: {
  defaultJobUrl?: string;
  defaults?: JobFormDefaults;
}) {
  const [state, formAction] = useActionState(saveJobAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <FormSuccessPopup redirectTo="/jobs" state={state} title="Job saved" />
      <div className="md:col-span-2">
        <FormStatusMessage state={state} />
      </div>
      <FormField
        error={state.fieldErrors?.company}
        helpText="The employer or team name."
        label="Company"
        required
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.company)}
          defaultValue={defaults?.company}
          name="company"
          minLength={2}
          placeholder="Northstar AI"
          required
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.title}
        helpText="Use the title from the posting."
        label="Job title"
        required
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.title)}
          defaultValue={defaults?.title}
          name="title"
          minLength={2}
          placeholder="Applied AI Engineer"
          required
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.job_url}
        helpText="Optional full URL, including https://."
        label="Job URL"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.job_url)}
          defaultValue={defaultJobUrl}
          name="job_url"
          placeholder="https://example.com/jobs/123"
          type="url"
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.location}
        helpText="Optional office, hybrid, or remote location."
        label="Location"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.location)}
          defaultValue={defaults?.location}
          name="location"
          placeholder="Remote, US"
        />
      </FormField>
      <FormField
        className="md:col-span-2"
        error={state.fieldErrors?.raw_description}
        helpText="Paste the full posting so the match analysis has enough context."
        label="Job description"
        required
      >
        <Textarea
          aria-invalid={Boolean(state.fieldErrors?.raw_description)}
          defaultValue={defaults?.rawDescription}
          name="raw_description"
          className="min-h-52"
          minLength={10}
          placeholder="Paste the full job description."
          required
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.contact_name}
        helpText="Optional recruiter, hiring manager, or referrer."
        label="Contact name"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.contact_name)}
          name="contact_name"
          placeholder="Maya Chen"
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.contact_email}
        helpText="Optional valid email address."
        label="Contact email"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.contact_email)}
          name="contact_email"
          placeholder="maya@example.com"
          type="email"
        />
      </FormField>
      <FormField
        className="md:col-span-2"
        error={state.fieldErrors?.contact_linkedin_url}
        helpText="Optional full LinkedIn URL, including https://."
        label="Contact LinkedIn URL"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.contact_linkedin_url)}
          name="contact_linkedin_url"
          placeholder="https://linkedin.com/in/maya"
          type="url"
        />
      </FormField>
      <FormField
        className="md:col-span-2"
        error={state.fieldErrors?.contact_notes}
        helpText="Optional context from outreach or referrals."
        label="Contact notes"
      >
        <Textarea
          aria-invalid={Boolean(state.fieldErrors?.contact_notes)}
          name="contact_notes"
          placeholder="Recruiter notes or LinkedIn context."
        />
      </FormField>
      <div className="md:col-span-2">
        <SubmitButton>Save job</SubmitButton>
      </div>
    </form>
  );
}
