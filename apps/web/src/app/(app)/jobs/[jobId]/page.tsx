import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, FileText } from "lucide-react";

import { JobStructuredView } from "@/components/job-structured-view";
import { SaveApplicationForm } from "@/components/forms/save-application-form";
import { formatShortDate, getContactLabel, getJobDetail } from "@/lib/data/server";
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

type JobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;
  const { job } = await getJobDetail(jobId);
  const jobRow = job as unknown as Record<string, unknown>;
  const structured = jobRow.structured_json;
  const hasStructured = Boolean(structured && typeof structured === "object");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link href="/jobs" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
          <ArrowLeft data-icon="inline-start" />
          Jobs
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{job.title}</h1>
            <p className="text-sm text-muted-foreground">
              {job.company} · Saved {formatShortDate(job.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Saved</Badge>
            <Badge variant={job.parse_status === "parsed" ? "success" : "outline"}>
              {job.parse_status === "parsed" ? "Parsed" : job.parse_status}
            </Badge>
          </div>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                  <BriefcaseBusiness className="size-4" />
                </div>
                <div>
                  <CardTitle>Job details</CardTitle>
                  <CardDescription>
                    {hasStructured
                      ? "Structured details extracted from the posting — responsibilities, skills, and requirements."
                      : "This job has not been parsed into structured details yet."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {hasStructured ? (
                <JobStructuredView structuredJson={structured} jobRow={jobRow} />
              ) : (
                <pre className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">
                  {job.raw_description}
                </pre>
              )}
            </CardContent>
          </Card>

          {hasStructured ? (
            <DetailsSection
              summary={
                <>
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  Original job description
                </>
              }
            >
              <pre className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">
                {job.raw_description}
              </pre>
            </DetailsSection>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Application tracker</CardTitle>
              <CardDescription>Save this job to track application progress.</CardDescription>
            </CardHeader>
            <CardContent>
              <SaveApplicationForm jobId={job.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job metadata</CardTitle>
              <CardDescription>Source details for this saved job.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <p className="font-medium">Company</p>
                <p className="text-muted-foreground">{job.company}</p>
              </div>
              <div>
                <p className="font-medium">Location</p>
                <p className="text-muted-foreground">{job.location || "Not provided"}</p>
              </div>
              <div>
                <p className="font-medium">Job URL</p>
                {job.job_url ? (
                  <a
                    href={job.job_url}
                    className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open posting
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="text-muted-foreground">Not provided</p>
                )}
              </div>
            </CardContent>
          </Card>

          <DetailsSection summary="Contact">
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{getContactLabel(job)}</p>
              <div>
                <p className="font-medium">Name</p>
                <p className="text-muted-foreground">{job.contact_name || "Not provided"}</p>
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-muted-foreground">{job.contact_email || "Not provided"}</p>
              </div>
              <div>
                <p className="font-medium">LinkedIn</p>
                <p className="break-all text-muted-foreground">
                  {job.contact_linkedin_url || "Not provided"}
                </p>
              </div>
              <div>
                <p className="font-medium">Notes</p>
                <p className="text-muted-foreground">{job.contact_notes || "No notes"}</p>
              </div>
            </div>
          </DetailsSection>
        </div>
      </section>
    </div>
  );
}
