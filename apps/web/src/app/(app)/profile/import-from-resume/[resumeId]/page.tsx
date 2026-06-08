import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";

import { ProfileImportReviewForm } from "@/components/forms/profile-import-review-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentSessionToken } from "@/lib/auth/server";
import { getResumeDetail } from "@/lib/data/server";
import { serverEnv } from "@/lib/env";
import { extractCandidateProfileFromResume } from "@/lib/profile-import-flow.mjs";

type ProfileImportPageProps = {
  params: Promise<{ resumeId: string }>;
};

export default async function ProfileImportPage({ params }: ProfileImportPageProps) {
  const { resumeId } = await params;
  const { resume } = await getResumeDetail(resumeId);
  const sessionToken = await getCurrentSessionToken();
  const result = await extractCandidateProfileFromResume({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    resumeId,
    sessionToken,
  });

  return (
    
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Link
          href={`/resumes/${resumeId}`}
          className={buttonVariants({ variant: "ghost", className: "w-fit" })}
        >
          <ArrowLeft data-icon="inline-start" />
          Resume
        </Link>

        <PageHeader
          eyebrow={resume.title}
          title="Review imported profile"
          description="Confirm the detected profile before saving it to your workspace."
        />

        {result.ok ? (
          <ProfileImportReviewForm
            resumeId={resumeId}
            candidateProfile={result.payload.candidate_profile}
            confidence={result.payload.confidence}
          />
        ) : (
          <Alert>
            <FileSearch />
            <AlertTitle>Import unavailable</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
      </div>
  );
}
