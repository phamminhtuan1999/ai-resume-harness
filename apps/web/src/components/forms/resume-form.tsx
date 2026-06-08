"use client";

import { useActionState, useRef } from "react";
import type { FormEvent } from "react";
import { FileUp } from "lucide-react";

import { idleActionState } from "@/lib/action-state";
import {
  getResumeFileValidationError,
  SUPPORTED_RESUME_FILE_EXTENSIONS,
  SUPPORTED_RESUME_FILE_MIME_TYPES,
} from "@/lib/action-validation.mjs";
import { saveResumeAction } from "@/lib/actions";
import { resumeSources } from "@/lib/app-data";
import { FormField } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ResumeForm() {
  const [state, formAction] = useActionState(saveResumeAction, idleActionState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const acceptedResumeFiles = [
    ...SUPPORTED_RESUME_FILE_EXTENSIONS,
    ...SUPPORTED_RESUME_FILE_MIME_TYPES,
  ].join(",");

  function clearResumeSourceValidation() {
    textInputRef.current?.setCustomValidity("");
    fileInputRef.current?.setCustomValidity("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const textValue = textInputRef.current?.value.trim() ?? "";
    const resumeFile = fileInputRef.current?.files?.[0];
    const hasFile = Boolean(resumeFile);

    clearResumeSourceValidation();

    if (resumeFile) {
      const fileError = getResumeFileValidationError(resumeFile);
      if (fileError) {
        fileInputRef.current?.setCustomValidity(fileError);
        fileInputRef.current?.reportValidity();
        event.preventDefault();
        return;
      }
    }

    if (!textValue && !hasFile) {
      textInputRef.current?.setCustomValidity("Paste resume text or choose a resume file.");
      textInputRef.current?.reportValidity();
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <FormSuccessPopup redirectTo="/resumes" state={state} title="Resume saved" />
      <FormStatusMessage state={state} />
      <FormField
        error={state.fieldErrors?.title}
        helpText="Use a short label you can recognize later."
        label="Resume title"
        required
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.title)}
          name="title"
          minLength={2}
          placeholder="Primary AI Engineer resume"
          required
        />
      </FormField>
      <input type="hidden" name="source_type" value="text" />
      <FormField
        error={state.fieldErrors?.raw_text}
        helpText="Required when no file is selected. Markdown and plain text are accepted."
        label="Paste Markdown or plain text"
      >
        <Textarea
          aria-invalid={Boolean(state.fieldErrors?.raw_text)}
          ref={textInputRef}
          name="raw_text"
          className="min-h-56"
          onChange={clearResumeSourceValidation}
          placeholder="Paste resume content here, or upload a file below."
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.resume_file}
        helpText="Optional. PDF, DOCX, PNG, JPG, WEBP, Markdown, and TXT files up to 10 MB."
        label="Import PDF, DOCX, image, Markdown, or text"
      >
        <Input
          aria-invalid={Boolean(state.fieldErrors?.resume_file)}
          ref={fileInputRef}
          name="resume_file"
          type="file"
          accept={acceptedResumeFiles}
          onChange={clearResumeSourceValidation}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        {resumeSources.map((source) => (
          <Badge key={source} variant="secondary">
            {source}
          </Badge>
        ))}
      </div>
      <SubmitButton>
        <FileUp data-icon="inline-start" />
        Save resume
      </SubmitButton>
    </form>
  );
}
