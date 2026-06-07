import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AppShell } from "@/components/app-shell";
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

type JobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;
  const { appUser, profile, job } = await getJobDetail(jobId);

  return (
    <AppShell
      active="Jobs"
      userName={profile.full_name || appUser?.fullName}
      userTarget={profile.target_role}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Link href="/jobs" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
            <ArrowLeft data-icon="inline-start" />
            Jobs
          </Link>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{job.title}</h1>
              <p className="text-sm text-muted-foreground">
                {job.company} · Saved {formatShortDate(job.created_at)}
              </p>
            </div>
            <Badge variant="secondary">Saved</Badge>
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Job description</CardTitle>
              <CardDescription>Raw job description saved for matching.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-6">
                {job.raw_description}
              </pre>
            </CardContent>
          </Card>

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
                <CardDescription>{job.parse_status}</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
                <CardDescription>{getContactLabel(job)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
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
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
