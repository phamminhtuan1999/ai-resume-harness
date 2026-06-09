import { JobIntake } from "@/components/forms/job-intake";
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        description="Paste a job URL to fetch it automatically, or add the description yourself."
        title="Add a job"
      />
      <SetupNotice />
      <Card>
        <CardHeader>
          <CardTitle>Add a job</CardTitle>
          <CardDescription>
            Fetch a posting from its link, or paste the description manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobIntake />
        </CardContent>
      </Card>
    </div>
  );
}
