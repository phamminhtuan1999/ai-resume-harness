import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  FileText,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

import { DashboardAiSummaryCard } from "@/components/dashboard/dashboard-ai-summary-card";
import { RadarChart } from "@/components/charts/radar-chart";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { MiniGauge } from "@/components/charts/ats-gauge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { resumeSources } from "@/lib/app-data";
import { getWorkspaceRecommendation } from "@/lib/dashboard-summary.mjs";
import {
  formatShortDate,
  getDashboardAiSummary,
  getInsightsData,
  getWorkspaceData,
} from "@/lib/data/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  suffix,
  hint,
  featured,
  children,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  featured?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 rounded-xl border bg-card p-4 shadow-sm",
        featured && "ring-1 ring-brand/30"
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-1.5 flex items-end gap-1.5">
          <span className="font-display text-3xl font-semibold leading-none tabular-nums">
            {value}
          </span>
          {suffix ? (
            <span className="mb-0.5 text-sm text-muted-foreground">{suffix}</span>
          ) : null}
        </div>
        {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const variant =
    score >= 75 ? "success" : score >= 60 ? "info" : score >= 40 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}</Badge>;
}

function ImprovementChip({ value }: { value: number }) {
  if (value === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const positive = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

type SetupStep = {
  label: string;
  sub: string;
  done: boolean;
  href: string;
  cta: string;
};

function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const completed = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);
  const pct = Math.round((completed / steps.length) * 100);
  const allDone = completed === steps.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>
          {allDone
            ? "You're all set — run an analysis to unlock your dashboard."
            : "A few quick steps to your first fit verdict and ATS score."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {completed}/{steps.length}
          </span>
        </div>

        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li
                key={step.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  step.done ? "bg-muted/30" : isCurrent ? "ring-1 ring-brand/30" : "opacity-70"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    step.done
                      ? "bg-brand text-brand-foreground"
                      : isCurrent
                        ? "bg-brand-muted text-brand"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.sub}</p>
                </div>
                {step.done ? (
                  <span className="text-xs font-medium text-success">Done</span>
                ) : isCurrent ? (
                  <Link href={step.href} className={buttonVariants({ size: "sm" })}>
                    {step.cta}
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Up next</span>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const { profile, resumes, jobs } = await getWorkspaceData();
  const aiSummary = await getDashboardAiSummary();
  const insights = await getInsightsData();
  const primaryResume = resumes[0];
  const profileTarget = profile?.target_role || "AI Engineer";
  const profileRole = profile?.current_role || "Software Engineer";
  const recommendation = getWorkspaceRecommendation({ profile, resumes, jobs });

  const hasAnalyses = insights.totalAnalyses > 0;

  const categoryBars = hasAnalyses
    ? [
        { label: "Skills", value: insights.avgSkillScore },
        { label: "Experience", value: insights.avgExperienceScore },
        { label: "AI readiness", value: insights.avgAiReadinessScore },
        { label: "ATS keywords", value: insights.avgAtsKeywordScore },
        { label: "Seniority", value: insights.avgSeniorityScore },
      ].filter((b) => b.value > 0)
    : [];

  const setupSteps: SetupStep[] = [
    {
      label: "Set up your profile",
      sub: "Tell ApplyWise your current and target role.",
      done: Boolean(profile?.target_role),
      href: "/profile",
      cta: "Set up profile",
    },
    {
      label: "Add your resume",
      sub: "Upload a PDF or DOCX, or paste the text.",
      done: resumes.length > 0,
      href: "/resumes/new",
      cta: "Add resume",
    },
    {
      label: "Save a target job",
      sub: "Add a job description to analyze against.",
      done: jobs.length > 0,
      href: "/jobs/new",
      cta: "Add a job",
    },
    {
      label: "Run your first analysis",
      sub: "Get your fit verdict and ATS score.",
      done: hasAnalyses,
      href: "/matches/new",
      cta: "Analyze a job",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* 1 — Header */}
      <PageHeader
        title={`Build a stronger ${profileTarget} application.`}
        description={
          profile?.target_role
            ? `Positioning as ${profileRole} → ${profileTarget}.`
            : "Set up your career profile, import a resume, and save target jobs."
        }
        actions={
          <>
            <Link href="/resumes/new" className={buttonVariants({ variant: "outline" })}>
              <Upload data-icon="inline-start" />
              Add resume
            </Link>
            <Link href="/matches/new" className={buttonVariants()}>
              <Sparkles data-icon="inline-start" />
              Analyze a job
            </Link>
          </>
        }
      />

      {hasAnalyses ? (
        <>
          {/* 2 — KPI strip */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Average ATS score"
              value={insights.averageScore}
              suffix="/ 100"
              hint={`Across ${insights.totalAnalyses} ${insights.totalAnalyses === 1 ? "analysis" : "analyses"}`}
              featured
            >
              <MiniGauge score={insights.averageScore} size={64} />
            </StatTile>

            <StatTile
              label="Best score"
              value={insights.bestScore}
              suffix="/ 100"
              hint={insights.bestScoreResumeTitle}
            />

            <StatTile
              label="Analyses run"
              value={insights.totalAnalyses}
              hint={`Across ${insights.byResume.length} ${insights.byResume.length === 1 ? "resume" : "resumes"}`}
            />

            <StatTile
              label="Setup progress"
              value={`${recommendation.score}%`}
              hint={recommendation.label}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <TrendingUp className="size-4" />
              </span>
            </StatTile>
          </section>

          {/* 3 — Honest-coach summary */}
          <DashboardAiSummaryCard
            hasEnoughData={aiSummary.hasEnoughData}
            summary={aiSummary.summary}
            run={aiSummary.run}
          />

          {/* 4 — Performance */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-brand" />
                  <CardTitle>Score trend</CardTitle>
                </div>
                <CardDescription>Every analysis you&apos;ve run, chronologically</CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreTrendChart data={insights.scoreTrend} height={220} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-brand" />
                  <CardTitle>Score breakdown</CardTitle>
                </div>
                <CardDescription>Averaged across all analyses</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryBars.length >= 3 ? (
                  <RadarChart data={categoryBars} />
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    Complete at least one analysis to see category scores.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* 5 — What to improve */}
          {insights.missingKeywords.length > 0 || insights.byResume.length > 0 ? (
            <section className="flex flex-col gap-4">
              {insights.missingKeywords.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Most-missed keywords</CardTitle>
                    <CardDescription>
                      Skills ATS systems expect but your resumes don&apos;t cover
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {insights.missingKeywords.map(({ keyword, count }) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/20 bg-destructive/[0.06] px-2.5 py-1 text-xs font-medium text-destructive"
                        >
                          {keyword}
                          <span className="rounded bg-destructive/[0.12] px-1 py-px text-[10px] font-semibold tabular-nums">
                            ×{count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {insights.byResume.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>By resume</CardTitle>
                    <CardDescription>How each of your resumes is performing</CardDescription>
                  </CardHeader>
                  <CardContent className="px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Resume</TableHead>
                          <TableHead className="text-right">Latest</TableHead>
                          <TableHead className="text-right">Best</TableHead>
                          <TableHead className="text-right">Improvement</TableHead>
                          <TableHead className="pr-6 text-right">Analyses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insights.byResume.map((row) => (
                          <TableRow key={row.resumeId}>
                            <TableCell className="pl-6 font-medium">
                              <Link
                                href={`/resumes/${row.resumeId}`}
                                className="flex items-center gap-1 hover:underline"
                              >
                                {row.resumeTitle}
                                <ArrowUpRight className="size-3 text-muted-foreground" />
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">
                              <ScoreChip score={row.latestScore} />
                            </TableCell>
                            <TableCell className="text-right">
                              <ScoreChip score={row.bestScore} />
                            </TableCell>
                            <TableCell className="text-right">
                              <ImprovementChip value={row.improvement} />
                            </TableCell>
                            <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                              {row.analysisCount}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        /* New user — guide setup instead of showing empty analytics */
        <GettingStarted steps={setupSteps} />
      )}

      {/* 6 — Workspace */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Primary resume</CardTitle>
            <CardDescription>
              {primaryResume
                ? `Last updated ${formatShortDate(primaryResume.updated_at)}`
                : "Import your first resume to get started."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <FileText className="size-4" />
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {primaryResume?.title || "No resume imported yet"}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {primaryResume
                      ? primaryResume.raw_text.slice(0, 160)
                      : "Paste text or upload a PDF, DOCX, image, Markdown, or plain text resume."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {primaryResume ? (
                    <>
                      <Badge variant="secondary">{primaryResume.source_type}</Badge>
                      <Badge variant="outline">{primaryResume.import_status}</Badge>
                    </>
                  ) : (
                    resumeSources.map((source) => (
                      <Badge key={source} variant="outline">
                        {source}
                      </Badge>
                    ))
                  )}
                </div>
                {primaryResume ? (
                  <Link
                    href={`/resumes/${primaryResume.id}`}
                    className="flex w-fit items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    View resume &amp; analytics
                    <ArrowUpRight className="size-3" />
                  </Link>
                ) : null}
              </div>
            </div>
            {!primaryResume ? (
              <Link href="/resumes/new" className={buttonVariants({ variant: "outline" })}>
                <Upload data-icon="inline-start" />
                Import resume
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent jobs</CardTitle>
                <CardDescription>
                  {jobs.length > 0
                    ? "Latest jobs saved under your account."
                    : "Saved jobs appear here after intake."}
                </CardDescription>
              </div>
              {jobs.length > 0 ? (
                <Link
                  href="/jobs"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  All jobs <ArrowUpRight className="size-3" />
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className={jobs.length > 0 ? "px-0" : undefined}>
            {jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="pr-6 text-right">Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.slice(0, 5).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="pl-6 font-medium">{job.company}</TableCell>
                      <TableCell className="text-muted-foreground">{job.title}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                        {formatShortDate(job.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                description="Add a job description to populate the tracker and dashboard."
                title="No recent jobs"
                action={
                  <Link href="/jobs/new" className={buttonVariants({ variant: "outline" })}>
                    <Sparkles data-icon="inline-start" />
                    Add a job
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
