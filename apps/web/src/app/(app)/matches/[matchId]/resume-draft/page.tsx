import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { ResumeDraftForm } from "@/components/forms/resume-draft-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getResumeDraftDetail } from "@/lib/data/server";

type ResumeDraftPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function ResumeDraftPage({ params }: ResumeDraftPageProps) {
  const { matchId } = await params;
  const { match, versions, suggestionCount } =
    await getResumeDraftDetail(matchId);
  const latestVersion = versions[0];

  return (
    
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Link
          href={`/matches/${match.id}`}
          className={buttonVariants({ variant: "ghost", className: "w-fit" })}
        >
          <ArrowLeft data-icon="inline-start" />
          Match report
        </Link>

        <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                  <FileText className="size-4" />
                </div>
                <div>
                  <CardTitle>Markdown resume draft</CardTitle>
                  <CardDescription>
                    {match.jobs?.company || "Unknown company"} -{" "}
                    {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Drafts use canonical resume text plus Truth Guard suggestions. Suggestions marked
              Do not use yet are excluded from generated Markdown.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generator</CardTitle>
              <CardDescription>
                {latestVersion
                  ? `Latest draft ${formatShortDate(latestVersion.created_at)}`
                  : `${suggestionCount} suggestions available`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeDraftForm matchId={match.id} />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{latestVersion?.title || "No draft generated yet"}</CardTitle>
                <CardDescription>
                  {latestVersion
                    ? `Version saved ${formatShortDate(latestVersion.created_at)}`
                    : "Generate a draft after creating or reviewing suggestions."}
                </CardDescription>
              </div>
              {latestVersion ? <Badge variant="secondary">Markdown</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            {latestVersion ? (
              <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-6">
                {latestVersion.content_markdown}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Generated Markdown drafts will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
