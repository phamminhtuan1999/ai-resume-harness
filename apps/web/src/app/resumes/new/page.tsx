import { FileUp, TextCursorInput } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { resumeSources } from "@/lib/app-data";
import { saveResumeAction } from "@/lib/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

export default function NewResumePage() {
  return (
    <AppShell active="Resumes">
      <div className="mx-auto grid w-full max-w-6xl gap-5 xl:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">Add resume</h1>
            <p className="text-sm text-muted-foreground">
              Paste Markdown/plain text or import a resume file for Docling conversion.
            </p>
          </div>
          <SetupNotice />
          <Card>
            <CardHeader>
              <CardTitle>Source resume</CardTitle>
              <CardDescription>Canonical content will be stored after save/import.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveResumeAction} className="flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Resume title
                  <Input name="title" placeholder="Primary AI Engineer resume" required />
                </label>
                <input type="hidden" name="source_type" value="text" />
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Paste Markdown or plain text
                  <Textarea
                    name="raw_text"
                    className="min-h-56"
                    placeholder="Paste resume content here, or upload a file below."
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Import PDF, DOCX, or image
                  <Input
                    type="file"
                    accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,text/plain,text/markdown"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {resumeSources.map((source) => (
                    <Badge key={source} variant="secondary">
                      {source}
                    </Badge>
                  ))}
                </div>
                <Button>
                  <FileUp data-icon="inline-start" />
                  Save resume
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
        <aside className="flex flex-col gap-5">
          <Alert>
            <TextCursorInput />
            <AlertTitle>Docling import path</AlertTitle>
            <AlertDescription>
              PDF, DOCX, and image resumes are normalized in the Python API before AI parsing.
              Text and Markdown can save directly as canonical content.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Import safeguards</CardTitle>
              <CardDescription>Planned backend checks for US-004.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>Reject unsupported MIME types before processing.</p>
              <p>Keep original files private if retention is enabled.</p>
              <p>Show clear errors when conversion fails.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
