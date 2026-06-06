import { AppShell } from "@/components/app-shell";
import { recentJobs } from "@/lib/app-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TrackerPage() {
  return (
    <AppShell active="Tracker">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Application tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track saved, applied, interviewing, offer, rejected, and archived jobs.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {recentJobs.map((job) => (
            <Card key={`${job.company}-${job.role}`}>
              <CardHeader>
                <CardTitle>{job.company}</CardTitle>
                <CardDescription>{job.role}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge variant="secondary">{job.status}</Badge>
                <span className="text-sm text-muted-foreground">{job.contact}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

