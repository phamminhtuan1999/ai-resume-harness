import Link from "next/link";
import {
  Check,
  CircleCheck,
  Loader2,
  Minus,
  Workflow,
  X,
} from "lucide-react";

import { AutoRefresh } from "@/components/auto-refresh";
import { RegenerateStepButton } from "@/components/forms/regenerate-step-button";
import { RunFullWorkflowForm } from "@/components/forms/run-full-workflow-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailsSection } from "@/components/ui/details-section";
import { Progress } from "@/components/ui/progress";
import {
  anyStepRunning,
  buildPanelRows,
  panelProgress,
  remainingActionableSteps,
  stepOutputDetails,
  stepStatusMeta,
} from "@/lib/ai-workflow-panel.mjs";
import { formatShortDate } from "@/lib/data/server";
import { cn } from "@/lib/utils";

type PanelRow = {
  workflow_type: string;
  name: string;
  description: string;
  prematch?: boolean;
  href?: string;
  status: "not_started" | "running" | "completed" | "needs_review" | "failed" | "blocked";
  summary: string;
  model_name: string | null;
  confidence_score: number | null;
  completed_at: string | null;
  error_message: string | null;
  snapshot: Record<string, unknown> | null;
  can_act: boolean;
};

type OutputSection = { label: string; text?: string; items?: string[] };

type AiWorkflowPanelProps = {
  matchId: string;
  runs: Record<string, unknown>[];
  profileReady: boolean;
  jobImported: boolean;
  jobParsed: boolean;
};

function StepMarker({ row, index }: { row: PanelRow; index: number }) {
  const base =
    "z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border bg-card";

  switch (row.status) {
    case "completed":
      return (
        <span
          className={cn(
            base,
            "border-transparent bg-success/15 text-[oklch(0.43_0.10_164)] dark:bg-success/20 dark:text-[oklch(0.84_0.13_166)]"
          )}
        >
          <Check className="size-3.5" />
        </span>
      );
    case "needs_review":
      return (
        <span
          className={cn(
            base,
            "border-transparent bg-warning/16 text-[oklch(0.45_0.09_70)] dark:bg-warning/20 dark:text-[oklch(0.85_0.13_82)]"
          )}
        >
          <Check className="size-3.5" />
        </span>
      );
    case "running":
      return (
        <span className={cn(base, "border-transparent bg-secondary text-foreground")}>
          <Loader2 className="size-3.5 animate-spin" />
        </span>
      );
    case "failed":
      return (
        <span
          className={cn(
            base,
            "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20"
          )}
        >
          <X className="size-3.5" />
        </span>
      );
    case "blocked":
      return (
        <span className={cn(base, "text-muted-foreground")}>
          <Minus className="size-3.5" />
        </span>
      );
    default:
      return (
        <span className={cn(base, "text-xs font-medium text-muted-foreground")}>
          {index + 1}
        </span>
      );
  }
}

function StepOutput({ row, matchId }: { row: PanelRow; matchId: string }) {
  const sections = stepOutputDetails(row.workflow_type, row.snapshot) as OutputSection[];
  if (sections.length === 0) {
    return null;
  }

  // Steps with a dedicated workspace page keep a link for actions (accept
  // suggestions, regenerate from context, etc.); reviewing happens inline.
  const pageHref = row.href ? `/matches/${matchId}/${row.href}` : null;

  return (
    <DetailsSection className="mt-2" summary="View output">
      <div className="grid gap-3">
        {sections.map((outputSection) => (
          <div key={outputSection.label}>
            <p className="text-sm font-medium">{outputSection.label}</p>
            {outputSection.text ? (
              <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                {outputSection.text}
              </p>
            ) : null}
            {outputSection.items ? (
              <ul className="mt-1 grid gap-1">
                {outputSection.items.map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="rounded-lg border bg-muted/20 px-3 py-1.5 text-sm leading-6"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {pageHref ? (
          <Link href={pageHref} className="w-fit text-sm font-medium text-foreground underline">
            Open full page
          </Link>
        ) : null}
      </div>
    </DetailsSection>
  );
}

export function AiWorkflowPanel({
  matchId,
  runs,
  profileReady,
  jobImported,
  jobParsed,
}: AiWorkflowPanelProps) {
  const rows = buildPanelRows({ runs, profileReady, jobImported, jobParsed }) as PanelRow[];
  const running = anyStepRunning(rows);
  const progress = panelProgress(rows) as {
    completed: number;
    total: number;
    percent: number;
  };
  const remaining = remainingActionableSteps(rows) as number;
  const totalActionable = rows.filter((row) => !row.prematch).length;

  return (
    <Card>
      <AutoRefresh active={running} />
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
              <Workflow className="size-4" />
            </div>
            <div className="grid gap-2">
              <div>
                <CardTitle>AI workflow</CardTitle>
                <CardDescription>
                  Every AI step for this application, run in order. Completed steps are
                  skipped — regenerate them individually instead.
                </CardDescription>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-full border px-3 py-1">
                <CircleCheck className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium whitespace-nowrap">
                  {progress.completed} of {progress.total}
                </span>
                <Progress className="w-24" value={progress.percent} />
                <span className="text-xs text-muted-foreground">{progress.percent}%</span>
              </div>
            </div>
          </div>
          <RunFullWorkflowForm
            matchId={matchId}
            disabled={running}
            remainingSteps={remaining}
            totalSteps={totalActionable}
          />
        </div>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            No AI steps have run yet. Click Run full workflow to prepare your
            application materials.
          </p>
        ) : null}
        <ol className="grid">
          {rows.map((row, index) => {
            const meta = stepStatusMeta(row.status);
            const isLast = index === rows.length - 1;
            const showActions = row.can_act && row.status !== "running";

            return (
              <li key={row.workflow_type} className="relative flex gap-3">
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute top-7 bottom-0 left-3.5 w-px bg-border"
                  />
                ) : null}
                <StepMarker row={row} index={index} />
                <article
                  aria-label={row.name}
                  className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-5")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={cn(
                        "min-w-0 pt-1 text-sm font-medium break-words",
                        row.status === "not_started" || row.status === "blocked"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      )}
                    >
                      {row.name}
                    </p>
                    <Badge className="mt-1 shrink-0" variant={meta.variant as never}>
                      {meta.label}
                    </Badge>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {row.summary}
                  </p>

                  {(row.model_name ||
                    row.confidence_score !== null ||
                    row.completed_at) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        row.model_name ? `Model: ${row.model_name}` : null,
                        row.confidence_score !== null
                          ? `Confidence: ${Math.round(row.confidence_score * 100)}%`
                          : null,
                        row.completed_at
                          ? `Last run: ${formatShortDate(row.completed_at)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {showActions ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {row.status === "failed" ? (
                        <RegenerateStepButton
                          matchId={matchId}
                          step={row.workflow_type}
                          label="Retry"
                        />
                      ) : null}
                      {row.status === "completed" || row.status === "needs_review" ? (
                        <RegenerateStepButton
                          matchId={matchId}
                          step={row.workflow_type}
                          label="Regenerate"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {(row.status === "completed" || row.status === "needs_review") &&
                  row.snapshot ? (
                    <StepOutput row={row} matchId={matchId} />
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
