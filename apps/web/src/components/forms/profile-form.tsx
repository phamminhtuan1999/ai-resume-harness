"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { idleActionState, type ActionState } from "@/lib/action-state";
import { saveProfileAction } from "@/lib/actions";
import { profileFields } from "@/lib/app-data";
import {
  COUNTRY_OPTIONS,
  callingCode,
  composeLocation,
  countryName,
} from "@/lib/contact-info.mjs";
import { valuesDiffer } from "@/lib/form-dirty.mjs";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ProfileFormProfile = {
  current_role: string | null;
  years_of_experience: number | null;
  target_role: string | null;
  location_city: string | null;
  location_country: string | null;
  // Derived "City, Country" string; kept for displaying legacy rows that
  // predate the structured city/country columns.
  location_preference: string | null;
  contact_email: string | null;
  phone: string | null;
  technical_background: string | null;
};

type ProfileFormProps = {
  profile?: ProfileFormProfile | null;
};

type ProfileValues = {
  current_role: string;
  years_of_experience: string;
  target_role: string;
  location_country: string;
  location_city: string;
  contact_email: string;
  phone: string;
  technical_background: string;
};

const targetRoleOptions = [
  "AI Engineer",
  "Applied AI Engineer",
  "LLM Engineer",
  "GenAI Engineer",
  "ML Engineer",
];

const DEFAULT_TECHNICAL_BACKGROUND = "Backend, APIs, SQL, cloud deployment";

function toFormValues(profile?: ProfileFormProfile | null): ProfileValues {
  return {
    current_role: profile?.current_role || profileFields[0].value,
    years_of_experience: String(profile?.years_of_experience ?? 4),
    target_role: profile?.target_role || profileFields[2].value,
    location_country: profile?.location_country || "",
    location_city: profile?.location_city || "",
    contact_email: profile?.contact_email || "",
    phone: profile?.phone || "",
    technical_background: profile?.technical_background || DEFAULT_TECHNICAL_BACKGROUND,
  };
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction] = useActionState(saveProfileAction, idleActionState);

  const initialValues = toFormValues(profile);
  // A row may exist with empty fields; treat the required fields as the signal
  // that a real profile was saved and can be shown read-only first.
  const hasSavedProfile = Boolean(profile && (profile.current_role || profile.target_role));

  const [mode, setMode] = useState<"view" | "edit">(hasSavedProfile ? "view" : "edit");
  const [baseline, setBaseline] = useState<ProfileValues>(initialValues);
  const [values, setValues] = useState<ProfileValues>(initialValues);
  const handledStateRef = useRef<ActionState | null>(null);

  const isDirty = valuesDiffer(baseline, values);

  // After a successful save, the submitted values are now the saved values:
  // adopt them as the new baseline and drop back to the read-only detail view.
  useEffect(() => {
    if (state.status === "success" && handledStateRef.current !== state) {
      handledStateRef.current = state;
      setBaseline(values);
      setMode("view");
    }
  }, [state, values]);

  function updateField(field: keyof ProfileValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function startEditing() {
    setBaseline(values);
    setMode("edit");
  }

  function cancelEditing() {
    setValues(baseline);
    setMode("view");
  }

  if (mode === "view") {
    return (
      <div className="grid gap-5">
        <FormSuccessPopup state={state} title="Profile saved" />
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <DetailItem label="Current role" value={values.current_role} />
          <DetailItem label="Years of experience" value={`${values.years_of_experience} years`} />
          <DetailItem label="Target role" value={values.target_role} />
          <DetailItem
            label="Location"
            value={
              composeLocation(values.location_city, values.location_country) ||
              profile?.location_preference ||
              ""
            }
          />
          <DetailItem label="Contact email" value={values.contact_email} />
          <DetailItem label="Phone" value={values.phone} />
          <DetailItem
            className="md:col-span-2"
            label="Technical background"
            value={values.technical_background}
          />
        </dl>
        <div>
          <Button type="button" onClick={startEditing}>
            Edit profile
          </Button>
        </div>
      </div>
    );
  }

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
          value={values.current_role}
          onChange={(event) => updateField("current_role", event.target.value)}
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
          value={values.years_of_experience}
          onChange={(event) => updateField("years_of_experience", event.target.value)}
          required
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.target_role}
        helpText="Choose the target role used for roadmap and match context."
        label="Target role"
        required
      >
        <Select
          aria-invalid={Boolean(state.fieldErrors?.target_role)}
          value={values.target_role}
          onChange={(event) => updateField("target_role", event.target.value)}
          name="target_role"
          required
        >
          {targetRoleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        error={state.fieldErrors?.location_country}
        helpText="Sets the phone format and the country shown on generated CVs."
        label="Country"
      >
        <Select
          aria-invalid={Boolean(state.fieldErrors?.location_country)}
          name="location_country"
          autoComplete="country"
          value={values.location_country}
          onChange={(event) => updateField("location_country", event.target.value)}
        >
          <option value="">Select a country</option>
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
              {country.callingCode ? ` (${country.callingCode})` : ""}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        error={state.fieldErrors?.location_city}
        helpText="Optional. Combined with the country as 'City, Country' on CVs."
        label="City"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.location_city)}
          name="location_city"
          autoComplete="address-level2"
          value={values.location_city}
          onChange={(event) => updateField("location_city", event.target.value)}
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.contact_email}
        helpText="Optional. Shown on generated CVs instead of the resume-imported email."
        label="Contact email"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.contact_email)}
          name="contact_email"
          type="email"
          autoComplete="email"
          value={values.contact_email}
          onChange={(event) => updateField("contact_email", event.target.value)}
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.phone}
        helpText={
          values.location_country
            ? `Validated for ${countryName(values.location_country)} (${callingCode(values.location_country)}); saved in international format.`
            : "Optional. Select a country, or start with + and a country code."
        }
        label="Phone"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.phone)}
          name="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(event) => updateField("phone", event.target.value)}
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
          value={values.technical_background}
          onChange={(event) => updateField("technical_background", event.target.value)}
        />
      </FormField>
      <div className="flex gap-2 md:col-span-2">
        <SubmitButton disabled={!isDirty}>Save profile</SubmitButton>
        {hasSavedProfile ? (
          <Button type="button" variant="outline" onClick={cancelEditing}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function DetailItem({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value?: string | null;
}) {
  return (
    <div className={className}>
      <dt className="font-medium">{label}</dt>
      <dd className="mt-1 text-muted-foreground">{value || "Not set"}</dd>
    </div>
  );
}
