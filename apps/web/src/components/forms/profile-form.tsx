"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { saveProfileAction } from "@/lib/actions";
import { profileFields } from "@/lib/app-data";
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
      <label className="flex flex-col gap-2 text-sm font-medium">
        Current role
        <Input name="current_role" defaultValue={currentRole} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Years of experience
        <Input
          name="years_of_experience"
          type="number"
          min="0"
          max="60"
          step="0.5"
          defaultValue={yearsOfExperience}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Target role
        <Input name="target_role" defaultValue={targetRole} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Location preference
        <Input name="location_preference" defaultValue={locationPreference} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
        Technical background
        <Input name="technical_background" defaultValue={technicalBackground} />
      </label>
      <div className="md:col-span-2">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
