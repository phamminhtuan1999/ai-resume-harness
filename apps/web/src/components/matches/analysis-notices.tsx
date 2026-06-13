import Link from "next/link";
import { AlertTriangle, UserPen } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { analysisHealthNotice } from "@/lib/analysis-error-view.mjs";
import { profilePromptFromReasons } from "@/lib/analysis-package-view.mjs";
import type { AnalysisPackage } from "@/lib/data/server";

type AnalysisNoticesProps = {
  pkg: AnalysisPackage;
  matchId: string;
};

// US-053 main-surface notices: a friendly, recoverable error/health banner and a
// profile-completeness warning. Both speak the assistant voice — no module names
// or error codes (those live in Advanced Analysis Details).
//
// At most ONE notice renders, by priority (health > completeness): stacked
// tinted boxes above the recommendation bury the verdict exactly when the user
// most needs orientation. The lower-priority condition still surfaces inline
// where it applies (the confidence box keeps its profile prompt).
export function AnalysisNotices({ pkg, matchId }: AnalysisNoticesProps) {
  const reasons = pkg.decision?.confidence.reasons ?? [];
  const health = analysisHealthNotice(reasons, { jobId: pkg.job.id ?? undefined }) as {
    title: string;
    message: string;
    recovery: { kind: "edit_job"; href: string } | { kind: "refresh" };
  } | null;
  const { showCompletenessWarning } = profilePromptFromReasons(reasons);

  if (health) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="size-4" />
          {health.title}
        </p>
        <p className="text-sm text-muted-foreground">{health.message}</p>
        {health.recovery.kind === "edit_job" ? (
          <Link
            href={health.recovery.href}
            className={buttonVariants({ variant: "outline", className: "w-fit" })}
          >
            Update the job description
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use <span className="font-medium">Refresh analysis</span> above to try again.
          </p>
        )}
      </div>
    );
  }

  if (showCompletenessWarning) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <UserPen className="size-4" />
          Your profile is missing some details
        </p>
        <p className="text-sm text-muted-foreground">
          This analysis is a rougher read because your profile doesn&apos;t show your background
          and target role yet. Filling it in sharpens every assessment.
        </p>
        <Link
          href={`/profile?recheck=${matchId}`}
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
        >
          Update your profile
        </Link>
      </div>
    );
  }

  return null;
}
