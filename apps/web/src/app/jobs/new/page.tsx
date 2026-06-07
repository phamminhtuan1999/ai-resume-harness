import { AppShell } from "@/components/app-shell";
import { JobForm } from "@/components/forms/job-form";
import { SetupNotice } from "@/components/setup-notice";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewJobPage() {
  return (
    <AppShell active="Jobs">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Analyze new job</h1>
          <p className="text-sm text-muted-foreground">
            Paste a job description manually and save contact details for tracking.
          </p>
        </div>
        <SetupNotice />
        <Card>
          <CardHeader>
            <CardTitle>Job description</CardTitle>
            <CardDescription>Manual intake only for MVP.</CardDescription>
          </CardHeader>
          <CardContent>
            <JobForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
