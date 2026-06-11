import Link from "next/link";
import { FileText, Upload } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { FlashToast } from "@/components/forms/flash-toast";
import { RecordActionsMenu } from "@/components/forms/record-actions-menu";
import { resumeSources } from "@/lib/app-data";
import { formatShortDate, getWorkspaceData } from "@/lib/data/server";
import { resumeDeletionSummaryGeneric } from "@/lib/deletion-view.mjs";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ResumesPageProps = {
  searchParams: Promise<{ flash?: string }>;
};

export default async function ResumesPage({ searchParams }: ResumesPageProps) {
  const { flash } = await searchParams;
  const { resumes } = await getWorkspaceData();

  return (

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <FlashToast code={flash} />
        <PageHeader
          actions={
          <Link href="/resumes/new" className={buttonVariants({ size: "lg" })}>
            <Upload data-icon="inline-start" />
            Add resume
          </Link>
          }
          description="Import a source resume and keep canonical Markdown ready for analysis."
          title="Resumes"
        />
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
                    <div className="flex items-start gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{resume.source_type}</Badge>
                        <Badge variant="outline">{resume.import_status}</Badge>
                      </div>
                      <RecordActionsMenu
                        kind="resume"
                        recordId={resume.id}
                        viewHref={`/resumes/${resume.id}`}
                        title={resume.title}
                        deleteSummary={resumeDeletionSummaryGeneric()}
                      />
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
              <EmptyState
                variant="create"
                description="Saved resumes will appear here after you paste text or import a supported file."
                icon={FileText}
                title="Add your first resume"
              >
                <div className="flex flex-wrap gap-2">
                  {resumeSources.map((source) => (
                    <Badge key={source} variant="outline">
                      {source}
                    </Badge>
                  ))}
                </div>
              </EmptyState>
            </CardContent>
          </Card>
        )}
      </div>
  );
}
