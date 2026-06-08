import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
        <PageHeader
          actions={
          <Link href="/jobs/new" className={buttonVariants({ size: "lg" })}>
            Analyze new job
          </Link>
          }
          description="Save job descriptions, company details, and contact context before analysis."
          title="Jobs"
        />
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
              <EmptyState
                action={
                  <Link href="/jobs/new" className={buttonVariants({ variant: "outline" })}>
                    Add job
                  </Link>
                }
                description="Add a job description to start tracking company, role, and contact details."
                icon={BriefcaseBusiness}
                title="No saved jobs"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
