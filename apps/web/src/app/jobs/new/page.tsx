import { AppShell } from "@/components/app-shell";
import { JobForm } from "@/components/forms/job-form";
import { PageHeader } from "@/components/page-header";
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
        <PageHeader
          description="Paste a job description and save contact details for tracking."
          title="Analyze new job"
        />
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
