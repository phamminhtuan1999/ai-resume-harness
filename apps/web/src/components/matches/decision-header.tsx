import { Briefcase, Clock, FileText, MapPin, TrendingUp } from "lucide-react";

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
};

const APPLIED_BANNER: Record<string, (date: string | null) => string> = {
  applied: (date) => (date ? `You applied on ${formatShortDate(date)}.` : "You applied to this role."),
  interviewing: () => "You're interviewing for this role.",
  offer: () => "You have an offer for this role.",
};

export function DecisionHeader({ pkg, matchId, coreChainRunning }: DecisionHeaderProps) {
  const decision = pkg.decision;
  if (!decision) {
    return null;
  }

  const meta = decisionMeta(decision.label);
  const verdictLine = formatVerdictLine(decision.match_score, decision.risk_level);
  const delta = decision.previous ? decisionDelta(decision.previous.label, decision.label) : null;
  const appliedKind = pkg.application ? liveApplicationKind(pkg.application.status) : null;
  const appliedText = appliedKind
    ? APPLIED_BANNER[appliedKind]?.(pkg.application?.applied_date ?? null)
    : null;

  const jobFacts = [pkg.job.location, pkg.job.work_type].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {appliedText ? (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm font-medium">
            {appliedText}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                {pkg.job.title || "This role"}
              </h1>
              {meta ? <Badge variant={meta.variant}>{meta.display}</Badge> : null}
            </div>
            <p className="text-sm font-medium text-muted-foreground">{verdictLine}</p>
            {delta ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp data-icon="inline-start" className="size-4 text-success" />
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
            <RefreshAnalysisControl
              matchId={matchId}
              coreChainRunning={coreChainRunning}
              currentLabel={decision.label}
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

        {pkg.stale ? (
          <p className="text-sm text-muted-foreground">
            Your resume, the job, or your profile changed after this assessment. Refresh for a
            current read.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
