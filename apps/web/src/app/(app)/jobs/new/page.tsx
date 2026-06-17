import { JobIntake } from "@/components/forms/job-intake";
import { PageHeader } from "@/components/page-header";
import { SetupNotice } from "@/components/setup-notice";

export default function NewJobPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        description="Search AI-related jobs or import a job you already found. ApplyWise will check whether the role fits your AI Engineer path."
        title="Add Job to ApplyWise"
      />
      <SetupNotice />
      <JobIntake />
    </div>
  );
}
