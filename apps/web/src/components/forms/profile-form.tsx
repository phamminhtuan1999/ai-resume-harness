"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { saveProfileAction } from "@/lib/actions";
import { profileFields } from "@/lib/app-data";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";

type ProfileFormProfile = {
  current_role: string | null;
  years_of_experience: number | null;
  target_role: string | null;
  location_preference: string | null;
  technical_background: string | null;
};

type ProfileFormProps = {
  profile?: ProfileFormProfile | null;
};

const targetRoleOptions = [
  "AI Engineer",
  "Applied AI Engineer",
  "LLM Engineer",
  "GenAI Engineer",
  "ML Engineer",
];

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction] = useActionState(saveProfileAction, idleActionState);
  const currentRole = profile?.current_role || profileFields[0].value;
  const yearsOfExperience = profile?.years_of_experience ?? 4;
  const targetRole = profile?.target_role || profileFields[2].value;
  const locationPreference = profile?.location_preference || profileFields[3].value;
  const technicalBackground =
    profile?.technical_background || "Backend, APIs, SQL, cloud deployment";

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <FormSuccessPopup state={state} title="Profile saved" />
      <div className="md:col-span-2">
        <FormStatusMessage state={state} />
      </div>
      <FormField
        error={state.fieldErrors?.current_role}
        helpText="Use the role that best describes your current experience."
        label="Current role"
        required
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.current_role)}
          name="current_role"
          defaultValue={currentRole}
          required
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.years_of_experience}
        helpText="Enter total relevant years, from 0 to 60."
        label="Years of experience"
        required
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.years_of_experience)}
          name="years_of_experience"
          type="number"
          min="0"
          max="60"
          step="0.5"
          defaultValue={yearsOfExperience}
          required
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.target_role}
        helpText="Choose the target role used for roadmap and match context."
        label="Target role"
        required
      >
        <select
          aria-invalid={Boolean(state.fieldErrors?.target_role)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          defaultValue={targetRole}
          name="target_role"
          required
        >
          {targetRoleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        error={state.fieldErrors?.location_preference}
        helpText="Optional location or remote preference."
        label="Location preference"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.location_preference)}
          name="location_preference"
          defaultValue={locationPreference}
        />
      </FormField>
      <FormField
        className="md:col-span-2"
        error={state.fieldErrors?.technical_background}
        helpText="Optional summary of languages, platforms, and domains."
        label="Technical background"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.technical_background)}
          name="technical_background"
          defaultValue={technicalBackground}
        />
      </FormField>
      <div className="md:col-span-2">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
