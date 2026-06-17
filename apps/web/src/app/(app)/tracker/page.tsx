import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { TrackerDistribution } from "@/components/charts/tracker-distribution";
import { TrackerRowActions } from "@/components/tracker/tracker-row-actions";
import { ApplicationStatusForm } from "@/components/forms/application-status-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import {
  TRACKED_STATUSES,
  getApplicationStatusLabel,
  partitionApplications,
} from "@/lib/application-tracker.mjs";
import { CONTACT_NOTE_LABEL, getContactNote } from "@/lib/tracker-row-actions.mjs";
import {
  formatShortDate,
  getContactLabel,
  getTrackerData,
} from "@/lib/data/server";

function statusVariant(status: string) {
  if (status === "rejected" || status === "archived") {
    return "outline" as const;
  }

  if (status === "offer") {
    return "success" as const;
  }

  if (status === "interviewing") {
    return "info" as const;
  }

  if (status === "learning_target") {
    return "warning" as const;
  }

  return "secondary" as const;
}

export default async function TrackerPage() {
  const { applications, statusSummary } = await getTrackerData();
  // Learning targets are not active applications — they live in their own
  // segment and never appear in the pipeline summary cards (US-052).
  const { tracked, learningTargets } = partitionApplications(applications);

  return (
    
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <PageHeader
          actions={
          <Link href="/matches" className={buttonVariants({ variant: "outline" })}>
            Find matches
          </Link>
          }
          description="Track saved, applied, interviewing, offer, rejected, and archived jobs."
          title="Application tracker"
        />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {TRACKED_STATUSES.map((status) => (
            <Card key={status}>
              <CardHeader className="gap-1">
                <CardDescription>{getApplicationStatusLabel(status)}</CardDescription>
                <CardTitle className="text-2xl">{statusSummary[status] ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        {/* US-080: distribution + active/closed/learning rollups over the same rows. */}
        <TrackerDistribution applications={applications} />

        {tracked.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tracked applications</CardTitle>
              <CardDescription>
                Update the status as each saved job moves through the application workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Workflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracked.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className="min-w-[260px] whitespace-normal">
                        <Link
                          href={`/jobs/${application.job_id}`}
                          className="font-medium hover:underline"
                        >
                          {application.jobs?.company || "Unknown company"}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          {application.jobs?.title || "Unknown role"}
                        </p>
                        <TrackerRowActions application={application} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(application.status)}>
                          {getApplicationStatusLabel(application.status)}
                        </Badge>
                        {application.applied_date ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Applied {formatShortDate(application.applied_date)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-[180px] whitespace-normal">
                        <p>{application.jobs ? getContactLabel(application.jobs) : "No contact"}</p>
                        {application.jobs?.contact_linkedin_url ? (
                          <a
                            className="break-all text-xs text-muted-foreground underline underline-offset-4"
                            href={application.jobs.contact_linkedin_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            LinkedIn
                          </a>
                        ) : null}
                        {getContactNote(application.jobs) ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{CONTACT_NOTE_LABEL}:</span>{" "}
                            {getContactNote(application.jobs)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {application.match_id ? (
                          <Link className="hover:underline" href={`/matches/${application.match_id}`}>
                            {application.matches?.overall_score ?? "View"}/100
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">No match</span>
                        )}
                      </TableCell>
                      <TableCell>{formatShortDate(application.updated_at)}</TableCell>
                      <TableCell className="whitespace-normal">
                        <ApplicationStatusForm
                          applicationId={application.id}
                          key={`${application.id}-${application.status}`}
                          status={application.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {learningTargets.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Learning Targets</CardTitle>
              <CardDescription>
                Roles you&apos;re building skills toward — not active applications. They don&apos;t
                count toward your pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Roadmap</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {learningTargets.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className="min-w-[220px] whitespace-normal">
                        <Link
                          href={`/jobs/${application.job_id}`}
                          className="font-medium hover:underline"
                        >
                          {application.jobs?.company || "Unknown company"}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          {application.jobs?.title || "Unknown role"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {application.match_id ? (
                          <Link
                            className="hover:underline"
                            href={`/matches/${application.match_id}`}
                          >
                            {application.matches?.overall_score ?? "View"}/100
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">No match</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {application.match_id ? (
                          <Link
                            className="text-sm font-medium underline underline-offset-4"
                            href={`/matches/${application.match_id}/roadmap`}
                          >
                            4-Week Roadmap
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatShortDate(application.updated_at)}</TableCell>
                      <TableCell className="whitespace-normal text-right">
                        <ApplicationStatusForm
                          applicationId={application.id}
                          key={`${application.id}-${application.status}`}
                          status={application.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {applications.length === 0 ? (
          <EmptyState
            variant="create"
            icon={ClipboardList}
            title="No tracked applications yet"
            description="Tracker rows appear after you save a job from a match or job detail page."
            action={
              <>
                <Link href="/matches" className={buttonVariants()}>
                  Review matches
                </Link>
                <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
                  View jobs
                </Link>
              </>
            }
          />
        ) : null}
      </div>
  );
}
