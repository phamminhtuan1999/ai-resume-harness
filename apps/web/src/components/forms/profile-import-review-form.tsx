"use client";

import { useActionState } from "react";

import { idleActionState } from "@/lib/action-state";
import { saveImportedProfileAction } from "@/lib/actions";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ProfileImportReviewFormProps = {
  confidence: Record<string, unknown>;
  candidateProfile: Record<string, unknown>;
  resumeId: string;
};

type BasicInfo = {
  current_title?: string | null;
  full_name?: string | null;
  location?: string | null;
  years_of_experience?: number | null;
};

type ProfessionalSummary = {
  primary_engineering_background?: string | null;
  seniority_level?: string | null;
};

type Skills = {
  ai_ml?: string[];
  backend?: string[];
  frontend?: string[];
  programming_languages?: string[];
};

type AIMetadata = {
  suggested_target_roles?: string[];
  strongest_skills?: string[];
};

export function ProfileImportReviewForm({
  candidateProfile,
  confidence,
  resumeId,
}: ProfileImportReviewFormProps) {
  const [state, formAction] = useActionState(saveImportedProfileAction, idleActionState);
  const basicInfo = readObject(candidateProfile.basic_info) as BasicInfo;
  const summary = readObject(candidateProfile.professional_summary) as ProfessionalSummary;
  const skills = readObject(candidateProfile.skills) as Skills;
  const metadata = readObject(candidateProfile.ai_metadata) as AIMetadata;
  const candidateProfileJson = JSON.stringify(candidateProfile, null, 2);
  const confidenceJson = JSON.stringify(confidence, null, 2);
  const strongestSkills = [
    ...(skills.programming_languages ?? []),
    ...(skills.backend ?? []),
    ...(skills.frontend ?? []),
    ...(skills.ai_ml ?? []),
    ...(metadata.strongest_skills ?? []),
  ].filter(Boolean);

  return (
    <form action={formAction} className="grid gap-5">
      <FormSuccessPopup redirectTo={state.redirectTo} state={state} title="Profile imported" />
      <FormStatusMessage state={state} successTitle="Profile imported" />
      <input type="hidden" name="resume_id" value={resumeId} />
      <input type="hidden" name="confidence_json" value={confidenceJson} />

      <Card>
        <CardHeader>
          <CardTitle>Detected profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <SummaryItem label="Name" value={basicInfo.full_name} />
          <SummaryItem label="Current role" value={basicInfo.current_title} />
          <SummaryItem
            label="Experience"
            value={
              typeof basicInfo.years_of_experience === "number"
                ? `${basicInfo.years_of_experience} years`
                : null
            }
          />
          <SummaryItem label="Location" value={basicInfo.location} />
          <SummaryItem label="Seniority" value={summary.seniority_level} />
          <SummaryItem
            label="Suggested target"
            value={metadata.suggested_target_roles?.[0] ?? null}
          />
          <div className="md:col-span-2">
            <p className="font-medium">Background</p>
            <p className="mt-1 text-muted-foreground">
              {summary.primary_engineering_background || "Not detected"}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="font-medium">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from(new Set(strongestSkills)).slice(0, 16).map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <FormField
        error={state.fieldErrors?.candidate_profile_json}
        helpText="Edit only if the detected content is wrong."
        label="Candidate profile JSON"
        required
      >
        <Textarea
          aria-invalid={Boolean(state.fieldErrors?.candidate_profile_json)}
          className="min-h-[360px] font-mono text-xs leading-5"
          name="candidate_profile_json"
          defaultValue={candidateProfileJson}
          required
          spellCheck={false}
        />
      </FormField>

      <div>
        <SubmitButton>Save imported profile</SubmitButton>
      </div>
    </form>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-muted-foreground">{value || "Not detected"}</p>
    </div>
  );
}

function readObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
