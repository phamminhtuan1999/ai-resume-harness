import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { saveJobAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
            <form action={saveJobAction} className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Company
                <Input name="company" placeholder="Northstar AI" required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Job title
                <Input name="title" placeholder="Applied AI Engineer" required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Job URL
                <Input name="job_url" placeholder="https://example.com/jobs/123" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Location
                <Input name="location" placeholder="Remote, US" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Job description
                <Textarea
                  name="raw_description"
                  className="min-h-52"
                  placeholder="Paste the full job description."
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Contact name
                <Input name="contact_name" placeholder="Maya Chen" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Contact email
                <Input name="contact_email" placeholder="maya@example.com" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Contact LinkedIn URL
                <Input name="contact_linkedin_url" placeholder="https://linkedin.com/in/maya" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Contact notes
                <Textarea name="contact_notes" placeholder="Recruiter notes or LinkedIn context." />
              </label>
              <div className="md:col-span-2">
                <Button>Save job</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
