import Link from "next/link";

import { CoverLetterForm } from "@/components/forms/cover-letter-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { letterSourceStatus } from "@/lib/cover-letter-view.mjs";
import { formatShortDate, getCoverLetterDetail } from "@/lib/data/server";

type CoverLetterPageProps = {
  params: Promise<{ matchId: string }>;
};

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export default async function CoverLetterPage({ params }: CoverLetterPageProps) {
  const { matchId } = await params;
  const { match, coverLetter, latestDraft } = await getCoverLetterDetail(matchId);

  const keyPoints = toStringList(coverLetter?.key_points_json);
  const claimsAvoided = toStringList(coverLetter?.claims_avoided_json);
  // US-063: which Tailored CV version produced this letter + staleness.
  const source = letterSourceStatus(coverLetter, latestDraft);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Cover letter</CardTitle>
            <CardDescription>
              {match.jobs?.company || "Unknown company"} -{" "}
              {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>
              {coverLetter?.cover_letter_strategy ||
                "Generate a personalized cover letter written from your Tailored CV — it can only reference claims that survived the truth guard, so it always matches the document you submit."}
            </p>
            {coverLetter?.tone ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{coverLetter.tone}</Badge>
                {coverLetter.provider ? (
                  <Badge variant="outline">{coverLetter.provider}</Badge>
                ) : null}
                {source && !source.legacy && source.sourceVersion != null ? (
                  <Badge variant="outline">From Tailored CV v{source.sourceVersion}</Badge>
                ) : null}
              </div>
            ) : null}
            {source?.isStale ? (
              <p className="text-xs text-warning-foreground">
                Your Tailored CV has changed since this letter
                {source.latestVersion != null ? ` (v${source.latestVersion} is current)` : ""}.
                Regenerate the letter so it matches the CV you&apos;ll submit.
              </p>
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
          <CardContent className="flex flex-col gap-3">
            {!latestDraft ? (
              <p className="text-xs text-warning-foreground">
                The letter is written from your Tailored CV.{" "}
                <Link
                  href={`/matches/${match.id}/draft-cv`}
                  className="font-medium underline underline-offset-2"
                >
                  Generate the Tailored CV first
                </Link>
                .
              </p>
            ) : null}
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
