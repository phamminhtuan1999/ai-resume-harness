import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { stepHref, stepStates } from "@/lib/tailoring-stepper.mjs";

type TailoringStepperProps = {
  matchId: string;
  suggestionCount: number;
  respondedCount: number;
  hasDraft: boolean;
  draftStatus: string | null;
};

// Shared tailoring-stepper header (US-061). Renders on the suggestions and
// draft-cv pages; steps link across the Resume Strategy / Application
// Materials tabs so the two-tier flow reads as one journey.
export function TailoringStepper({
  matchId,
  suggestionCount,
  respondedCount,
  hasDraft,
  draftStatus,
}: TailoringStepperProps) {
  const steps = stepStates({ suggestionCount, respondedCount, hasDraft, draftStatus });

  return (
    <nav
      aria-label="Tailoring steps"
      className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border bg-card px-3 py-2"
    >
      {steps.map(
        (
          step: { key: string; label: string; segment: string; state: string },
          index: number
        ) => (
          <div key={step.key} className="flex items-center gap-1">
            {index > 0 ? <span className="mx-1 h-px w-4 bg-border" aria-hidden /> : null}
            <Link
              href={stepHref(matchId, step)}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:text-foreground",
                step.state === "current"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  step.state === "current" && "border-transparent bg-primary text-primary-foreground",
                  step.state === "done" && "border-transparent bg-brand-muted text-foreground"
                )}
              >
                {step.state === "done" ? <Check className="size-3" /> : index + 1}
              </span>
              {step.label}
            </Link>
          </div>
        )
      )}
    </nav>
  );
}
