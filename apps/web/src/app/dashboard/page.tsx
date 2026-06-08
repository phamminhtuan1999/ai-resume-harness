import Link from "next/link";
import { ArrowUpRight, FileText, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { quickActions, resumeSources } from "@/lib/app-data";
import { getWorkspaceCounts, getWorkspaceRecommendation } from "@/lib/dashboard-summary.mjs";
import { formatShortDate, getContactLabel, getWorkspaceData } from "@/lib/data/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const { appUser, profile, resumes, jobs } = await getWorkspaceData();
  const primaryResume = resumes[0];
  const profileTarget = profile?.target_role || "AI Engineer";
  const profileRole = profile?.current_role || "Software Engineer";
  const counts = getWorkspaceCounts({ profile, resumes, jobs });
  const recommendation = getWorkspaceRecommendation({ profile, resumes, jobs });

  return (
    <AppShell
      active="Dashboard"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <PageHeader
                className="flex-1"
                description={
                  profile?.target_role
                    ? `Profile ready for ${profileRole} to ${profileTarget} positioning.`
                    : "Set up your career profile, import a resume, and save target jobs."
                }
                title={`Build a stronger ${profileTarget} application.`}
              />
              <Link href="/resumes/new" className={buttonVariants({ size: "lg" })}>
                <Upload data-icon="inline-start" />
                Add resume
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                        <Icon className="size-4" />
                      </span>
                      {action.label}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workspace status</CardTitle>
              <CardDescription>Live counts for your saved application materials.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Profiles", counts.profiles],
                  ["Resumes", counts.resumes],
                  ["Jobs", counts.jobs],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <div className="text-xl font-semibold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Recommendation</span>
                  <Badge variant="secondary">{recommendation.label}</Badge>
                </div>
                <Progress value={recommendation.score} />
                <p className="text-sm leading-6 text-muted-foreground">{recommendation.message}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Primary resume</CardTitle>
              <CardDescription>
                {primaryResume
                  ? `Last updated ${formatShortDate(primaryResume.updated_at)}`
                  : "Supported sources for the first import flow."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                  <FileText className="size-4" />
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {primaryResume?.title || "No resume imported yet"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {primaryResume
                        ? primaryResume.raw_text.slice(0, 180)
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
                </div>
              </div>
              <Link href="/resumes/new" className={buttonVariants({ variant: "outline" })}>
                Open resume import
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI workflow status</CardTitle>
              <CardDescription>Demo-ready MVP workflow modules.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[
                "Docling import",
                "Match analyzer",
                "Resume suggestions",
                "Roadmap and interview prep",
              ].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{item}</span>
                    <Badge variant="secondary">implemented</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <CardDescription>
              {jobs.length > 0
                ? "Latest jobs saved under your account."
                : "Saved jobs appear here after manual intake."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.slice(0, 5).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell>{job.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.parse_status}</Badge>
                      </TableCell>
                      <TableCell>{getContactLabel(job)}</TableCell>
                      <TableCell className="text-right">{formatShortDate(job.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                description="Add a job description to populate the tracker and dashboard."
                title="No recent jobs"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
