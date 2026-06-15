import Link from "next/link";
import { ArrowLeft, BarChart3, FileText, UserRound, UserRoundSearch } from "lucide-react";

import { AtsGauge } from "@/components/charts/ats-gauge";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { RadarChart } from "@/components/charts/radar-chart";
import { CandidateProfileView } from "@/components/candidate-profile-view";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";
import {
  formatShortDate,
  getResumeDeletionImpact,
  getResumeDetail,
  getResumeMatchHistory,
} from "@/lib/data/server";
import { resumeDeletionSummary } from "@/lib/deletion-view.mjs";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailsSection } from "@/components/ui/details-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ResumeDetailPageProps = {
  params: Promise<{ resumeId: string }>;
};

function ScoreChip({ score }: { score: number }) {
  const variant =
    score >= 75 ? "success" : score >= 60 ? "info" : score >= 40 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}</Badge>;
}

export default async function ResumeDetailPage({ params }: ResumeDetailPageProps) {
  const { resumeId } = await params;
  const { resume, candidateProfile, profile } = await getResumeDetail(resumeId);
  const hasProfile = Boolean(candidateProfile && typeof candidateProfile === "object");
  const deletionImpact = await getResumeDeletionImpact(resume.id, profile.id);
  const matchHistory = await getResumeMatchHistory(resumeId);

  const latestMatch = matchHistory[matchHistory.length - 1] ?? null;
  const bestMatch = matchHistory.length > 0
    ? matchHistory.reduce((best, m) => m.overallScore > best.overallScore ? m : best)
    : null;

  const scoreTrend = matchHistory.map((m, i) => ({
    label: `#${i + 1}`,
    score: m.overallScore,
    date: m.analyzedAt,
  }));

  const categoryBars = latestMatch
    ? [
        { label: "Skills", value: latestMatch.skillScore, color: "var(--color-chart-1)" },
        { label: "Experience", value: latestMatch.experienceScore, color: "var(--color-chart-2)" },
        { label: "AI readiness", value: latestMatch.aiReadinessScore, color: "var(--color-chart-3)" },
        { label: "ATS keywords", value: latestMatch.atsKeywordScore, color: "var(--color-chart-4)" },
        { label: "Seniority", value: latestMatch.seniorityScore, color: "var(--color-chart-5)" },
      ].filter((b) => b.value > 0)
    : [];

  const hasAnalyses = matchHistory.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link href="/resumes" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
          <ArrowLeft data-icon="inline-start" />
          Resumes
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{resume.title}</h1>
            <p className="text-sm text-muted-foreground">
              Saved {formatShortDate(resume.created_at)} · Updated{" "}
              {formatShortDate(resume.updated_at)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/profile/import-from-resume/${resume.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <UserRoundSearch data-icon="inline-start" />
                {hasProfile ? "Re-import profile" : "Import profile"}
              </Link>
              <DeleteRecordButton
                kind="resume"
                recordId={resume.id}
                summary={resumeDeletionSummary(deletionImpact)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{resume.source_type}</Badge>
              <Badge variant="outline">{resume.import_status}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics section */}
      {hasAnalyses ? (
        <>
          {/* Top stats */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Latest score</p>
              <div className="mt-1 flex items-end gap-1.5">
                <span className="font-display text-2xl font-semibold tabular-nums leading-none">
                  {latestMatch!.overallScore}
                </span>
                <span className="mb-0.5 text-sm text-muted-foreground">/ 100</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {latestMatch!.jobCompany} — {latestMatch!.jobTitle}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Best score</p>
              <div className="mt-1 flex items-end gap-1.5">
                <span className="font-display text-2xl font-semibold tabular-nums leading-none">
                  {bestMatch!.overallScore}
                </span>
                <span className="mb-0.5 text-sm text-muted-foreground">/ 100</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {matchHistory.length} {matchHistory.length === 1 ? "analysis" : "analyses"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Improvement</p>
              {matchHistory.length > 1 ? (
                <div className="mt-1 flex items-end gap-1.5">
                  <span
                    className="font-display text-2xl font-semibold tabular-nums leading-none"
                    style={{
                      color:
                        latestMatch!.overallScore - matchHistory[0].overallScore >= 0
                          ? "var(--color-success)"
                          : "var(--color-destructive)",
                    }}
                  >
                    {latestMatch!.overallScore - matchHistory[0].overallScore >= 0 ? "+" : ""}
                    {latestMatch!.overallScore - matchHistory[0].overallScore}
                  </span>
                  <span className="mb-0.5 text-sm text-muted-foreground">pts since first</span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Run more analyses to track improvement</p>
              )}
            </div>
          </div>

          {/* Score trend + ATS gauge */}
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-brand" />
                  <CardTitle>Score evolution</CardTitle>
                </div>
                <CardDescription>How scores changed across every analysis run</CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreTrendChart data={scoreTrend} height={200} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ATS readiness</CardTitle>
                <CardDescription>Latest analysis result</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pt-2">
                <AtsGauge score={latestMatch!.overallScore} size={180} />
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown */}
          {categoryBars.length >= 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
                <CardDescription>Category scores from the most recent analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <RadarChart data={categoryBars} />
              </CardContent>
            </Card>
          )}

          {/* Analysis history table */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis history</CardTitle>
              <CardDescription>All jobs analyzed against this resume</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Job</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right pr-6">Analyzed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchHistory.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-6 font-medium">
                        <Link href={`/matches/${m.id}`} className="hover:underline">
                          {m.jobCompany} — {m.jobTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreChip score={m.overallScore} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground pr-6">
                        {formatShortDate(m.analyzedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-brand">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <p className="font-medium">No analyses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Analyze a job against this resume to see score evolution and breakdowns here.
              </p>
            </div>
            <Link href="/matches/new" className={buttonVariants({ variant: "outline" })}>
              Analyze a job
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Candidate profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
              <UserRound className="size-4" />
            </div>
            <div>
              <CardTitle>Candidate profile</CardTitle>
              <CardDescription>
                {hasProfile
                  ? "The structured profile extracted from your resume — skills, experience, projects, and AI-role readiness."
                  : "No structured profile imported yet."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasProfile ? (
            <CandidateProfileView profileJson={candidateProfile} />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Import the profile from this resume to see your skills, work history,
              projects, and AI-role readiness broken out here instead of raw text.
            </p>
          )}
        </CardContent>
      </Card>

      <DetailsSection
        summary={
          <>
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            Canonical resume text
          </>
        }
      >
        <pre className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">
          {resume.raw_text}
        </pre>
      </DetailsSection>

      <DetailsSection summary="Import metadata">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium">Source file</p>
            <p className="text-muted-foreground">{resume.source_file_name || "Direct text entry"}</p>
          </div>
          <div>
            <p className="font-medium">MIME type</p>
            <p className="text-muted-foreground">{resume.source_mime_type || "Not applicable"}</p>
          </div>
          <div>
            <p className="font-medium">Size</p>
            <p className="text-muted-foreground">
              {resume.source_size_bytes ? `${resume.source_size_bytes} bytes` : "Not recorded"}
            </p>
          </div>
          <div>
            <p className="font-medium">Import error</p>
            <p className="text-muted-foreground">{resume.import_error || "None"}</p>
          </div>
        </div>
      </DetailsSection>
    </div>
  );
}
