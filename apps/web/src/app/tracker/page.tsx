import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { formatShortDate, getContactLabel, getWorkspaceData } from "@/lib/data/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function TrackerPage() {
  const { appUser, profile, jobs } = await getWorkspaceData();

  return (
    <AppShell
      active="Tracker"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Application tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track saved, applied, interviewing, offer, rejected, and archived jobs.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {jobs.length > 0 ? (
            jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/jobs/${job.id}`} className="hover:underline">
                      {job.company}
                    </Link>
                  </CardTitle>
                  <CardDescription>{job.title}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Saved</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatShortDate(job.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{getContactLabel(job)}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>No tracked jobs</CardTitle>
                <CardDescription>
                  Saved jobs will appear here with contact and application status.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
