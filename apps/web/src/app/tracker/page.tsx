import Link from "next/link";

import { ApplicationStatusForm } from "@/components/forms/application-status-form";
import { AppShell } from "@/components/app-shell";
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
  APPLICATION_STATUSES,
  getApplicationStatusLabel,
} from "@/lib/application-tracker.mjs";
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
    return "default" as const;
  }

  return "secondary" as const;
}

export default async function TrackerPage() {
  const { appUser, applications, profile, statusSummary } = await getTrackerData();

  return (
    <AppShell
      active="Tracker"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Application tracker</h1>
            <p className="text-sm text-muted-foreground">
              Track saved, applied, interviewing, offer, rejected, and archived jobs.
            </p>
          </div>
          <Link href="/matches" className={buttonVariants({ variant: "outline" })}>
            Find matches
          </Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {APPLICATION_STATUSES.map((status) => (
            <Card key={status}>
              <CardHeader className="gap-1">
                <CardDescription>{getApplicationStatusLabel(status)}</CardDescription>
                <CardTitle className="text-2xl">{statusSummary[status] ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        {applications.length > 0 ? (
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
                  {applications.map((application) => (
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No tracked applications</CardTitle>
              <CardDescription>
                Save a matched job or job description to start tracking application progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Link href="/matches" className={buttonVariants({ variant: "default" })}>
                Review matches
              </Link>
              <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
                View jobs
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
