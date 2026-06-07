import Link from "next/link";
import { FileText, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { resumeSources } from "@/lib/app-data";
import { formatShortDate, getWorkspaceData } from "@/lib/data/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResumesPage() {
  const { appUser, profile, resumes } = await getWorkspaceData();

  return (
    <AppShell
      active="Resumes"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
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
        {resumes.length > 0 ? (
          <div className="grid gap-4">
            {resumes.map((resume) => (
              <Card key={resume.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>
                        <Link href={`/resumes/${resume.id}`} className="hover:underline">
                          {resume.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        Saved {formatShortDate(resume.created_at)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{resume.source_type}</Badge>
                      <Badge variant="outline">{resume.import_status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {resume.raw_text}
                  </p>
                  <Link
                    href={`/resumes/${resume.id}`}
                    className={buttonVariants({ variant: "outline", className: "mt-4 w-fit" })}
                  >
                    View resume
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
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
                    Saved resumes will appear here after you paste Markdown/plain text or import a
                    supported file.
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
        )}
      </div>
    </AppShell>
  );
}
