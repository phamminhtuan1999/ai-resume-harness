"use client";

import { useActionState, useRef } from "react";
import type { FormEvent } from "react";
import { FileUp } from "lucide-react";

import { idleActionState } from "@/lib/action-state";
import { saveResumeAction } from "@/lib/actions";
import { resumeSources } from "@/lib/app-data";
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

  function clearResumeSourceValidation() {
    textInputRef.current?.setCustomValidity("");
    fileInputRef.current?.setCustomValidity("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const textValue = textInputRef.current?.value.trim() ?? "";
    const hasFile = Boolean(fileInputRef.current?.files?.length);

    clearResumeSourceValidation();

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
      <label className="flex flex-col gap-2 text-sm font-medium">
        Resume title
        <Input name="title" minLength={2} placeholder="Primary AI Engineer resume" required />
      </label>
      <input type="hidden" name="source_type" value="text" />
      <label className="flex flex-col gap-2 text-sm font-medium">
        Paste Markdown or plain text
        <Textarea
          ref={textInputRef}
          name="raw_text"
          className="min-h-56"
          onChange={clearResumeSourceValidation}
          placeholder="Paste resume content here, or upload a file below."
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Import PDF, DOCX, or image
        <Input
          ref={fileInputRef}
          name="resume_file"
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,text/plain,text/markdown"
          onChange={clearResumeSourceValidation}
        />
      </label>
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
