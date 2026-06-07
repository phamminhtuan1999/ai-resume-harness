import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { formatShortDate, getContactLabel, getWorkspaceData } from "@/lib/data/server";
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

export default async function JobsPage() {
  const { appUser, profile, jobs } = await getWorkspaceData();

  return (
    <AppShell
      active="Jobs"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Manual job description intake for the MVP.
            </p>
          </div>
          <Link href="/jobs/new" className={buttonVariants({ size: "lg" })}>
            Analyze New Job
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Saved jobs</CardTitle>
            <CardDescription>
              {jobs.length > 0
                ? "Jobs saved under your account."
                : "Saved jobs will appear after manual intake."}
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
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="hover:underline">
                          {job.title}
                        </Link>
                      </TableCell>
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
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Add a job description to start tracking company, role, and contact details.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
