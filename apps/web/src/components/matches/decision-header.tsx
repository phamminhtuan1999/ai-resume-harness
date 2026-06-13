import {
  Briefcase,
  Clock,
  FileText,
  MapPin,
  MoveRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { RefreshAnalysisControl } from "@/components/matches/refresh-analysis-control";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  decisionDelta,
  decisionMeta,
  formatVerdictLine,
  liveApplicationKind,
} from "@/lib/analysis-package-view.mjs";
import { formatShortDate } from "@/lib/data/server";
import type { AnalysisPackage } from "@/lib/data/server";

type DecisionHeaderProps = {
  pkg: AnalysisPackage;
  matchId: string;
  coreChainRunning: boolean;
  refreshBilling?: { enforced: boolean; cost: number; balance: number };
};

// The delta icon must match the delta direction — a green up-arrow on a
// downgrade is a visual claim the data contradicts (Truth Guard applies to
// icons too). Down stays neutral: the verdict badge carries the news.
const DELTA_ICONS = {
  Up: { Icon: TrendingUp, className: "size-4 text-success" },
  Down: { Icon: TrendingDown, className: "size-4 text-muted-foreground" },
  Changed: { Icon: MoveRight, className: "size-4 text-muted-foreground" },
} as const;

// Rendered as a quiet chip beside the verdict, not a full-width banner — the
// verdict stays the only block-level statement at the top of the page.
const APPLIED_CHIP: Record<string, (date: string | null) => string> = {
  applied: (date) => (date ? `Applied ${formatShortDate(date)}` : "Applied"),
  interviewing: () => "Interviewing",
  offer: () => "Offer received",
};

export function DecisionHeader({
  pkg,
  matchId,
  coreChainRunning,
  refreshBilling,
}: DecisionHeaderProps) {
  const decision = pkg.decision;
  if (!decision) {
    return null;
  }

  const meta = decisionMeta(decision.label);
  const verdictLine = formatVerdictLine(decision.match_score, decision.risk_level);
  const delta = decision.previous ? decisionDelta(decision.previous.label, decision.label) : null;
  const appliedKind = pkg.application ? liveApplicationKind(pkg.application.status) : null;
  const appliedText = appliedKind
    ? APPLIED_CHIP[appliedKind]?.(pkg.application?.applied_date ?? null)
    : null;

  const jobFacts = [pkg.job.location, pkg.job.work_type].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
                {pkg.job.title || "This role"}
              </h1>
              {meta ? <Badge variant={meta.variant}>{meta.display}</Badge> : null}
              {appliedText ? <Badge variant="success">{appliedText}</Badge> : null}
            </div>
            {/* Never render an empty verdict line: a missing score and an
                unmapped risk would otherwise leave a blank paragraph at the
                most important spot on the page. */}
            {verdictLine ? (
              <p className="text-sm font-medium text-muted-foreground">{verdictLine}</p>
            ) : null}
            {delta ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {(() => {
                  const { Icon, className } =
                    DELTA_ICONS[delta.direction as keyof typeof DELTA_ICONS] ?? DELTA_ICONS.Changed;
                  return <Icon data-icon="inline-start" className={className} />;
                })()}
                {delta.direction} from {delta.fromDisplay}
                {decision.previous?.decided_at
                  ? ` · ${formatShortDate(decision.previous.decided_at)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {pkg.analyzed_at ? `Last analyzed ${formatShortDate(pkg.analyzed_at)}` : "Not yet analyzed"}
              {pkg.stale ? <Badge variant="warning">Out of date</Badge> : null}
            </div>
            {/* The stale explanation is visible text, not a hover-only title:
                keyboard, screen-reader, and touch users get the reassurance
                the badge alone can't carry. */}
            {pkg.stale ? (
              <p className="max-w-xs text-xs leading-5 text-muted-foreground md:text-right">
                Your resume, the job, or your profile changed after this assessment — refresh for a
                current read.
              </p>
            ) : null}
            <RefreshAnalysisControl
              matchId={matchId}
              coreChainRunning={coreChainRunning}
              currentLabel={decision.label}
              billing={refreshBilling}
              stale={pkg.stale}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {pkg.job.company ? (
            <span className="flex items-center gap-1.5">
              <Briefcase className="size-4" />
              {pkg.job.company}
            </span>
          ) : null}
          {jobFacts ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {jobFacts}
            </span>
          ) : null}
          {pkg.resume.title ? (
            <span className="flex items-center gap-1.5">
              <FileText className="size-4" />
              Based on {pkg.resume.title}
            </span>
          ) : null}
        </div>

      </CardContent>
    </Card>
  );
}
