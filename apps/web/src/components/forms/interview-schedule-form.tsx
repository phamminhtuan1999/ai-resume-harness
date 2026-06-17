"use client";

import { useActionState, useState } from "react";
import { CalendarClock } from "lucide-react";

import { FormFieldError } from "@/components/forms/form-field";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEW_STAGES, getInterviewStageLabel } from "@/lib/interview-schedule.mjs";
import { valuesDiffer } from "@/lib/form-dirty.mjs";
import { idleActionState } from "@/lib/action-state";
import { updateInterviewScheduleAction } from "@/lib/actions";

type InterviewScheduleFormProps = {
  applicationId: string;
  interviewDate: string | null;
  interviewStage: string | null;
  interviewNotes: string | null;
};

export function InterviewScheduleForm({
  applicationId,
  interviewDate,
  interviewStage,
  interviewNotes,
}: InterviewScheduleFormProps) {
  const [state, formAction] = useActionState(updateInterviewScheduleAction, idleActionState);

  const initial = {
    interview_date: interviewDate ?? "",
    interview_stage: interviewStage ?? "",
    interview_notes: interviewNotes ?? "",
  };

  const [fields, setFields] = useState(initial);
  const [saved, setSaved] = useState(initial);

  // After a successful save the loader revalidates and feeds fresh props in;
  // re-sync so the form returns to a clean state. A failed save leaves the saved
  // snapshot unchanged, keeping the edit and Save enabled for retry. Render-time
  // sync is preferred over an effect (matches ApplicationStatusForm).
  const savedDiffers = valuesDiffer(saved, initial);
  if (savedDiffers) {
    setSaved(initial);
    setFields(initial);
  }

  const isDirty = valuesDiffer(saved, fields);

  return (
    <form action={formAction} className="grid min-w-[230px] gap-2">
      <FormSuccessPopup state={state} title="Interview saved" />
      <input name="application_id" type="hidden" value={applicationId} />

      <div className="flex flex-wrap gap-2">
        <div className="flex-1">
          <label className="sr-only" htmlFor={`interview-date-${applicationId}`}>
            Interview date
          </label>
          <Input
            aria-invalid={Boolean(state.fieldErrors?.interview_date)}
            id={`interview-date-${applicationId}`}
            name="interview_date"
            onChange={(event) =>
              setFields((prev) => ({ ...prev, interview_date: event.target.value }))
            }
            type="date"
            value={fields.interview_date}
          />
        </div>
        <div className="flex-1">
          <label className="sr-only" htmlFor={`interview-stage-${applicationId}`}>
            Interview stage
          </label>
          <Select
            aria-invalid={Boolean(state.fieldErrors?.interview_stage)}
            id={`interview-stage-${applicationId}`}
            name="interview_stage"
            onChange={(event) =>
              setFields((prev) => ({ ...prev, interview_stage: event.target.value }))
            }
            value={fields.interview_stage}
          >
            <option value="">No stage</option>
            {INTERVIEW_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {getInterviewStageLabel(stage)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <label className="sr-only" htmlFor={`interview-notes-${applicationId}`}>
        Interview notes
      </label>
      <Textarea
        aria-invalid={Boolean(state.fieldErrors?.interview_notes)}
        className="min-h-16 text-sm"
        id={`interview-notes-${applicationId}`}
        name="interview_notes"
        onChange={(event) =>
          setFields((prev) => ({ ...prev, interview_notes: event.target.value }))
        }
        placeholder="Round details, interviewer, prep reminders…"
        value={fields.interview_notes}
      />

      <SubmitButton className="w-fit" disabled={!isDirty} variant="outline">
        <CalendarClock data-icon="inline-start" />
        Save interview
      </SubmitButton>

      <FormFieldError
        error={
          state.fieldErrors?.application_id ||
          state.fieldErrors?.interview_date ||
          state.fieldErrors?.interview_stage ||
          state.fieldErrors?.interview_notes
        }
      />
      <FormStatusMessage state={state} successTitle="Saved" />
    </form>
  );
}
