import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { CoverLetterForm } from "@/components/forms/cover-letter-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getCoverLetterDetail } from "@/lib/data/server";

type CoverLetterPageProps = {
  params: Promise<{ matchId: string }>;
};

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export default async function CoverLetterPage({ params }: CoverLetterPageProps) {
  const { matchId } = await params;
  const { match, coverLetter } = await getCoverLetterDetail(matchId);

  const keyPoints = toStringList(coverLetter?.key_points_json);
  const claimsAvoided = toStringList(coverLetter?.claims_avoided_json);

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
                <Mail className="size-4" />
              </div>
              <div>
                <CardTitle>Cover letter</CardTitle>
                <CardDescription>
                  {match.jobs?.company || "Unknown company"} -{" "}
                  {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>
              {coverLetter?.cover_letter_strategy ||
                "Generate a personalized cover letter built around your strongest supported angle. It references the company and role and avoids claims your resume does not support."}
            </p>
            {coverLetter?.tone ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{coverLetter.tone}</Badge>
                {coverLetter.provider ? (
                  <Badge variant="outline">{coverLetter.provider}</Badge>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator</CardTitle>
            <CardDescription>
              {coverLetter
                ? `Last generated ${formatShortDate(coverLetter.updated_at)}`
                : "Create the first cover letter."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoverLetterForm matchId={match.id} hasExisting={Boolean(coverLetter)} />
          </CardContent>
        </Card>
      </section>

      {coverLetter?.cover_letter ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Generated cover letter</CardTitle>
              <CardDescription>Review and edit before sending.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-6">
                {coverLetter.cover_letter}
              </pre>
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key points used</CardTitle>
              </CardHeader>
              <CardContent>
                {keyPoints.length > 0 ? (
                  <ul className="grid gap-2">
                    {keyPoints.map((point, index) => (
                      <li
                        key={`${point}-${index}`}
                        className="rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No key points recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Claims avoided</CardTitle>
                <CardDescription>Unproven skills the letter does not claim.</CardDescription>
              </CardHeader>
              <CardContent>
                {claimsAvoided.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {claimsAvoided.map((claim) => (
                      <Badge key={claim} variant="warning">
                        {claim}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No cover letter yet</CardTitle>
            <CardDescription>
              Generate a cover letter after the match has been analyzed.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
