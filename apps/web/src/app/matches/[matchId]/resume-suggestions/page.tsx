import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { ResumeSuggestionsForm } from "@/components/forms/resume-suggestions-form";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getResumeSuggestionsDetail } from "@/lib/data/server";

type ResumeSuggestionsPageProps = {
  params: Promise<{ matchId: string }>;
};

function truthVariant(status: string) {
  if (status === "Safe to use") {
    return "secondary" as const;
  }

  return "outline" as const;
}

export default async function ResumeSuggestionsPage({ params }: ResumeSuggestionsPageProps) {
  const { matchId } = await params;
  const { appUser, profile, match, suggestions } = await getResumeSuggestionsDetail(matchId);

  return (
    <AppShell
      active="Matches"
      userName={profile.full_name || appUser?.fullName}
      userTarget={profile.target_role}
    >
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
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <CardTitle>Resume suggestions</CardTitle>
                  <CardDescription>
                    {match.jobs?.company || "Unknown company"} -{" "}
                    {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Generated suggestions use Truth Guard labels so unsupported claims stay separate
                from wording that is already supported by resume evidence.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generator</CardTitle>
              <CardDescription>
                {suggestions.length > 0
                  ? `Last generated ${formatShortDate(suggestions[0].created_at)}`
                  : "Create the first suggestion set."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeSuggestionsForm matchId={match.id} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <Card key={suggestion.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {suggestion.related_job_requirement || "Resume positioning"}
                      </CardTitle>
                      <CardDescription>{suggestion.suggestion_type || "suggestion"}</CardDescription>
                    </div>
                    <Badge variant={truthVariant(suggestion.truth_guard_status)}>
                      {suggestion.truth_guard_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm leading-6">
                  <div>
                    <p className="font-medium">Suggested text</p>
                    <p className="text-muted-foreground">{suggestion.suggested_text}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="font-medium">Evidence</p>
                      <p className="text-muted-foreground">
                        {suggestion.evidence || "No evidence recorded."}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Reason</p>
                      <p className="text-muted-foreground">
                        {suggestion.reason || "No reason recorded."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No suggestions yet</CardTitle>
                <CardDescription>
                  Generate suggestions after reviewing the match score and missing skills.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </AppShell>
  );
}
