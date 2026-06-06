import Link from "next/link";
import { FileText, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { resumeSources } from "@/lib/app-data";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResumesPage() {
  return (
    <AppShell active="Resumes">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Resumes</h1>
            <p className="text-sm text-muted-foreground">
              Import a source resume and keep canonical Markdown ready for analysis.
            </p>
          </div>
          <Link href="/resumes/new" className={buttonVariants({ size: "lg" })}>
            <Upload data-icon="inline-start" />
            Add Resume
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No saved resumes</CardTitle>
            <CardDescription>Start with a text paste or file import.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                <FileText className="size-4" />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Supported resume sources are ready in the UI contract; backend persistence and
                  auth are the next wiring step.
                </p>
                <div className="flex flex-wrap gap-2">
                  {resumeSources.map((source) => (
                    <Badge key={source} variant="outline">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

