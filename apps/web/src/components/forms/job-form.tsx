"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { saveJobAction } from "@/lib/actions";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function JobForm() {
  const [state, formAction] = useActionState(saveJobAction, idleActionState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <FormSuccessPopup redirectTo="/jobs" state={state} title="Job saved" />
      <div className="md:col-span-2">
        <FormStatusMessage state={state} />
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Company
        <Input name="company" minLength={2} placeholder="Northstar AI" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Job title
        <Input name="title" minLength={2} placeholder="Applied AI Engineer" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Job URL
        <Input name="job_url" placeholder="https://example.com/jobs/123" type="url" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Location
        <Input name="location" placeholder="Remote, US" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
        Job description
        <Textarea
          name="raw_description"
          className="min-h-52"
          minLength={10}
          placeholder="Paste the full job description."
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Contact name
        <Input name="contact_name" placeholder="Maya Chen" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Contact email
        <Input name="contact_email" placeholder="maya@example.com" type="email" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
        Contact LinkedIn URL
        <Input name="contact_linkedin_url" placeholder="https://linkedin.com/in/maya" type="url" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
        Contact notes
        <Textarea name="contact_notes" placeholder="Recruiter notes or LinkedIn context." />
      </label>
      <div className="md:col-span-2">
        <SubmitButton>Save job</SubmitButton>
      </div>
    </form>
  );
}
