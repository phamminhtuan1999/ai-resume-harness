import Link from "next/link";
import { ArrowLeft, FileText, UserRound, UserRoundSearch } from "lucide-react";

import { CandidateProfileView } from "@/components/candidate-profile-view";
import { formatShortDate, getResumeDetail } from "@/lib/data/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailsSection } from "@/components/ui/details-section";

type ResumeDetailPageProps = {
  params: Promise<{ resumeId: string }>;
};

export default async function ResumeDetailPage({ params }: ResumeDetailPageProps) {
  const { resumeId } = await params;
  const { resume, candidateProfile } = await getResumeDetail(resumeId);
  const hasProfile = Boolean(candidateProfile && typeof candidateProfile === "object");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link href="/resumes" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
          <ArrowLeft data-icon="inline-start" />
          Resumes
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{resume.title}</h1>
            <p className="text-sm text-muted-foreground">
              Saved {formatShortDate(resume.created_at)} · Updated{" "}
              {formatShortDate(resume.updated_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/profile/import-from-resume/${resume.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <UserRoundSearch data-icon="inline-start" />
              {hasProfile ? "Re-import profile" : "Import profile"}
            </Link>
            <Badge variant="secondary">{resume.source_type}</Badge>
            <Badge variant="outline">{resume.import_status}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
              <UserRound className="size-4" />
            </div>
            <div>
              <CardTitle>Candidate profile</CardTitle>
              <CardDescription>
                {hasProfile
                  ? "The structured profile extracted from your resume — skills, experience, projects, and AI-role readiness."
                  : "No structured profile imported yet."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasProfile ? (
            <CandidateProfileView profileJson={candidateProfile} />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Import the profile from this resume to see your skills, work history,
              projects, and AI-role readiness broken out here instead of raw text.
            </p>
          )}
        </CardContent>
      </Card>

      <DetailsSection
        summary={
          <>
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            Canonical resume text
          </>
        }
      >
        <pre className="max-h-[640px] overflow-auto rounded-lg border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">
          {resume.raw_text}
        </pre>
      </DetailsSection>

      <DetailsSection summary="Import metadata">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium">Source file</p>
            <p className="text-muted-foreground">{resume.source_file_name || "Direct text entry"}</p>
          </div>
          <div>
            <p className="font-medium">MIME type</p>
            <p className="text-muted-foreground">{resume.source_mime_type || "Not applicable"}</p>
          </div>
          <div>
            <p className="font-medium">Size</p>
            <p className="text-muted-foreground">
              {resume.source_size_bytes ? `${resume.source_size_bytes} bytes` : "Not recorded"}
            </p>
          </div>
          <div>
            <p className="font-medium">Import error</p>
            <p className="text-muted-foreground">{resume.import_error || "None"}</p>
          </div>
        </div>
      </DetailsSection>
    </div>
  );
}
