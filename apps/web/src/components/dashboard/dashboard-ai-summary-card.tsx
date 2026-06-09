import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { DashboardSummaryForm } from "@/components/forms/dashboard-summary-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NOT_ENOUGH_DATA_MESSAGE,
  healthLabel,
  healthVariant,
  normalizeDashboardAiSummary,
} from "@/lib/dashboard-ai-summary.mjs";

type DashboardAiSummaryCardProps = {
  hasEnoughData: boolean;
  summary: Record<string, unknown> | null;
  run: {
    status: string;
    model_provider: string | null;
    confidence_score: number | null;
    completed_at: string | null;
  } | null;
};

type SummaryView = {
  dashboard_summary: string;
  best_fit_roles: string[];
  repeated_skill_gaps: string[];
  job_search_health: string;
  recommended_next_actions: string[];
  confidence_score: number | null;
  provider: string | null;
};

export function DashboardAiSummaryCard({
  hasEnoughData,
  summary,
  run,
}: DashboardAiSummaryCardProps) {
  const view = normalizeDashboardAiSummary(summary) as SummaryView;
  const needsReview = run?.status === "needs_review";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle>AI job search summary</CardTitle>
            <CardDescription>
              Patterns across every job you have analyzed — not one match at a time.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6">
        {!hasEnoughData ? (
          <>
            <p className="text-muted-foreground">{NOT_ENOUGH_DATA_MESSAGE}</p>
            <Link
              href="/jobs/new"
              className="flex w-fit items-center gap-1 font-medium text-foreground underline"
            >
              Add a job
              <ArrowUpRight className="size-4" />
            </Link>
          </>
        ) : !summary ? (
          <>
            <p className="text-muted-foreground">
              Your job search summary hasn&apos;t been generated yet.
            </p>
            <DashboardSummaryForm hasExisting={false} />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Job search health:</span>
              <Badge variant={healthVariant(view.job_search_health) as never}>
                {healthLabel(view.job_search_health)}
              </Badge>
              {view.provider ? (
                <Badge variant="outline">
                  {view.provider === "gemini" ? "AI generated" : "Baseline"}
                </Badge>
              ) : null}
              {needsReview ? <Badge variant="warning">Needs review</Badge> : null}
            </div>

            {view.dashboard_summary ? (
              <p className="text-muted-foreground">{view.dashboard_summary}</p>
            ) : null}

            {view.best_fit_roles.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Best-fit roles:</span>
                {view.best_fit_roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            ) : null}

            {view.repeated_skill_gaps.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Repeated skill gaps:</span>
                {view.repeated_skill_gaps.map((gap) => (
                  <Badge key={gap} variant="warning">
                    {gap}
                  </Badge>
                ))}
              </div>
            ) : null}

            {view.recommended_next_actions.length > 0 ? (
              <div>
                <p className="font-medium">Recommended next actions</p>
                <ol className="mt-2 grid list-decimal gap-1 pl-5 text-muted-foreground">
                  {view.recommended_next_actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            <DashboardSummaryForm hasExisting />
          </>
        )}
      </CardContent>
    </Card>
  );
}
