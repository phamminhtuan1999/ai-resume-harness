import { TextCursorInput } from "lucide-react";

import { ResumeForm } from "@/components/forms/resume-form";
import { PageHeader } from "@/components/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewResumePage() {
  return (
    
      <div className="mx-auto grid w-full max-w-6xl gap-5 xl:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-5">
          <PageHeader
            description="Paste Markdown or plain text, or import a resume file for conversion."
            title="Add resume"
          />
          <SetupNotice />
          <Card>
            <CardHeader>
              <CardTitle>Source resume</CardTitle>
              <CardDescription>Canonical content will be stored after save/import.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeForm />
            </CardContent>
          </Card>
        </section>
        <aside className="flex flex-col gap-5">
          <Alert>
            <TextCursorInput />
            <AlertTitle>File conversion</AlertTitle>
            <AlertDescription>
              PDF, DOCX, and image resumes are converted to clean text before analysis.
              Markdown and plain text are stored as-is.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>How import works</CardTitle>
              <CardDescription>What happens to a file you add.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>Supported formats: PDF, DOCX, image, Markdown, and plain text.</p>
              <p>Unsupported or oversized files are rejected before processing.</p>
              <p>Conversion errors are shown inline so you can fix and retry.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
  );
}
