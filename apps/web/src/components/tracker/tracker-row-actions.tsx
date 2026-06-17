import Link from "next/link";
import { FileText, Mail, Map, MessageSquare, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildTrackerRowActions } from "@/lib/tracker-row-actions.mjs";

// Row-level shortcuts for a tracker application (US-081). Compact ghost links so
// the row stays scannable; each routes to the match sub-route that owns the
// artifact (and generates it there when missing). No client state — pure links.

const MATERIAL_ICONS: Record<string, typeof FileText> = {
  draft_cv: FileText,
  cover_letter: Mail,
  interview_prep: MessageSquare,
  roadmap: Map,
};

type TrackerApplication = {
  job_id?: string | null;
  match_id?: string | null;
  status?: string | null;
};

export function TrackerRowActions({ application }: { application: TrackerApplication }) {
  const { analysis, materials, hasMatch } = buildTrackerRowActions(application);

  // No linked match yet — the analysis and every material live behind one.
  if (!hasMatch) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Analyze this job to unlock tailored materials.
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {analysis ? (
        <Link
          className={buttonVariants({ variant: "outline", size: "xs" })}
          href={analysis.href}
        >
          <Sparkles aria-hidden />
          {analysis.label}
        </Link>
      ) : null}
      {materials.map((material) => {
        const Icon = MATERIAL_ICONS[material.key] ?? FileText;
        return (
          <Link
            className={cn(
              buttonVariants({ variant: material.prominent ? "outline" : "ghost", size: "xs" }),
              material.prominent && "border-warning/60 text-warning"
            )}
            href={material.href}
            key={material.key}
          >
            <Icon aria-hidden />
            {material.label}
          </Link>
        );
      })}
    </div>
  );
}
