import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { FlashToast } from "@/components/forms/flash-toast";
import { RecordActionsMenu } from "@/components/forms/record-actions-menu";
import { formatShortDate, getContactLabel, getWorkspaceData } from "@/lib/data/server";
import type { WorkspaceJob, WorkspaceProfile } from "@/lib/data/server";
import { jobDeletionSummaryGeneric } from "@/lib/deletion-view.mjs";
import { computeJobPreScore, preScoreTierLabel } from "@/lib/job-prescore.mjs";
import { QuickMatchControl } from "@/components/jobs/quick-match-control";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type JobsPageProps = {
  searchParams: Promise<{ flash?: string }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { flash } = await searchParams;
  const { jobs, matches, profile } = await getWorkspaceData();

  const bestScoreByJob = new Map<string, number>();
  for (const match of matches) {
    const current = bestScoreByJob.get(match.job_id);
    if (current === undefined || match.overall_score > current) {
      bestScoreByJob.set(match.job_id, match.overall_score);
    }
  }

  return (
    
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <FlashToast code={flash} />
        <PageHeader
          actions={
          <Link href="/jobs/new" className={buttonVariants({ size: "lg" })}>
            Analyze new job
          </Link>
          }
          description="Add a job by URL or paste a description, then track company and contact context."
          title="Jobs"
        />
        <Card>
          <CardHeader>
            <CardTitle>Saved jobs</CardTitle>
            <CardDescription>
              {jobs.length > 0
                ? "Jobs saved under your account."
                : "Saved jobs will appear here once you add one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Fit hint</TableHead>
                    <TableHead>Quick match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Saved</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="hover:underline">
                          {job.title}
                        </Link>
                      </TableCell>
                      <TableCell>{renderMatchScore(bestScoreByJob.get(job.id))}</TableCell>
                      <TableCell>{renderFitHint(job, profile)}</TableCell>
                      <TableCell>
                        <QuickMatchControl jobId={job.id} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.parse_status}</Badge>
                      </TableCell>
                      <TableCell>{getContactLabel(job)}</TableCell>
                      <TableCell className="text-right">{formatShortDate(job.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <RecordActionsMenu
                          kind="job"
                          recordId={job.id}
                          viewHref={`/jobs/${job.id}`}
                          title={job.title}
                          company={job.company}
                          deleteSummary={jobDeletionSummaryGeneric()}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                variant="create"
                action={
                  <Link href="/jobs/new" className={buttonVariants({ variant: "outline" })}>
                    Add job
                  </Link>
                }
                description="Add a job by URL or paste a description to start tracking company, role, and contact details."
                icon={BriefcaseBusiness}
                title="No saved jobs"
              />
            )}
          </CardContent>
        </Card>
      </div>
  );
}

function renderMatchScore(score: number | undefined) {
  if (score === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const variant: "success" | "warning" | "secondary" =
    score >= 70 ? "success" : score >= 45 ? "warning" : "secondary";
  return <Badge variant={variant}>{score}</Badge>;
}

// The local pre-score (US-068): a deterministic hint computed from saved data,
// no model call. Deliberately a quiet, word-labelled hint — never a number or a
// solid verdict badge — so it can't be mistaken for the analyzed Match score.
function renderFitHint(job: WorkspaceJob, profile: WorkspaceProfile | null) {
  const { tier } = computeJobPreScore({ profile, job });
  if (tier === "insufficient") {
    return <span className="text-xs text-muted-foreground">Not enough info</span>;
  }
  const dotClass =
    tier === "strong"
      ? "bg-success"
      : tier === "promising"
        ? "bg-warning"
        : "bg-muted-foreground/50";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title="A quick local estimate from your profile and this job's details — not the analyzed verdict."
    >
      <span className={`size-1.5 rounded-full ${dotClass}`} aria-hidden />
      {preScoreTierLabel(tier)}
    </span>
  );
}
