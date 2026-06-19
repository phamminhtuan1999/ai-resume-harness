"use client";

import { useActionState, type ReactNode } from "react";
import { Bookmark, ExternalLink, Sparkles } from "lucide-react";

import { idleActionState } from "@/lib/action-state";
import { recordApplyLinkOpenedAction, saveIntakeJobAction } from "@/lib/actions";
import { FormStatusMessage } from "@/components/forms/form-status-message";
import { FormSuccessPopup } from "@/components/forms/form-success-popup";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type IntakeMode = "search" | "url" | "paste";

/**
 * Save / Save & Analyze / Open Apply Link for the Add Job hub (US-077).
 *
 * One form posts the serialized intake payload to a single dispatcher action;
 * the clicked button's `intent` chooses Save (persist only) or Save & Analyze
 * (persist + run the existing analysis and route to the report). The in-memory
 * AI relevance + quick match ride along in `payload` and are mirrored onto the
 * job at save (decision 0026). Saving and previewing never spend credits.
 *
 * `children` are the URL/paste confirm fields (title/company/location); search
 * results have none. Open Apply Link opens the posting and records the action;
 * it is hidden when no apply URL exists.
 */
export function IntakeSaveActions({
  mode,
  payload,
  applyUrl = null,
  jobTitle,
  jobId = null,
  saveLabel = "Save",
  primaryAction = "save",
  children,
}: {
  mode: IntakeMode;
  payload: unknown;
  applyUrl?: string | null;
  jobTitle: string;
  jobId?: string | null;
  saveLabel?: string;
  /**
   * Which button leads the row. "save" (default) keeps Save as the filled
   * primary and Save & Analyze as the outline — used by the URL/paste confirm
   * steps. "analyze" makes Save & Analyze the hero (filled) and Save a quiet
   * ghost beside it — used by the discovery result cards, where analysing is
   * the high-value next step.
   */
  primaryAction?: "save" | "analyze";
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState(saveIntakeJobAction, idleActionState);
  const payloadJson = JSON.stringify(payload ?? {});
  const apply = (applyUrl ?? "").trim();
  const analyzeFirst = primaryAction === "analyze";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormSuccessPopup
        redirectTo={state.status === "success" ? state.redirectTo : undefined}
        state={state}
        title="Job saved"
      />
      {state.status === "error" && <FormStatusMessage state={state} />}

      <input name="mode" type="hidden" value={mode} />
      <input name="payload_json" type="hidden" value={payloadJson} />
      {children}

      <div className="flex flex-wrap items-center gap-2">
        {analyzeFirst ? (
          <>
            <SubmitButton
              name="intent"
              pendingLabel="Analyzing…"
              size="sm"
              title="Save & analyze"
              value="analyze"
            >
              <Sparkles className="size-4" />
              Analyze
            </SubmitButton>
            <SubmitButton
              name="intent"
              pendingLabel="Saving…"
              size="sm"
              value="save"
              variant="ghost"
            >
              <Bookmark className="size-4" />
              {saveLabel}
            </SubmitButton>
          </>
        ) : (
          <>
            <SubmitButton name="intent" pendingLabel="Saving…" size="sm" value="save">
              {saveLabel}
            </SubmitButton>
            <SubmitButton
              name="intent"
              pendingLabel="Analyzing…"
              size="sm"
              value="analyze"
              variant="outline"
            >
              Save &amp; Analyze
            </SubmitButton>
          </>
        )}
        {apply ? (
          <a
            aria-label={analyzeFirst ? "Open apply link" : undefined}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted",
              analyzeFirst ? "ml-auto w-8" : "px-3"
            )}
            href={apply}
            onClick={() => {
              // Fire-and-forget breadcrumb; never blocks opening the posting.
              void recordApplyLinkOpenedAction({ jobId, title: jobTitle });
            }}
            rel="noopener noreferrer"
            target="_blank"
            title={analyzeFirst ? "Open apply link" : undefined}
          >
            {!analyzeFirst && "Open Apply Link"}
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Editable confirm fields for the URL/paste save (the user confirms or fixes
 * the extracted title/company before saving — Section 9: we never invent them).
 * Submitted as overrides; `raw_description` rides hidden in the payload.
 */
export function IntakeConfirmFields({
  defaults,
}: {
  defaults: { company?: string | null; title?: string | null; location?: string | null };
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Company
        <Input defaultValue={defaults.company ?? ""} minLength={2} name="company" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Job title
        <Input defaultValue={defaults.title ?? ""} minLength={2} name="title" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Location <span className="font-normal text-muted-foreground">(optional)</span>
        <Input defaultValue={defaults.location ?? ""} name="location" placeholder="Remote, US" />
      </label>
    </div>
  );
}
