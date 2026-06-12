import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { ResumeSuggestionsForm } from "@/components/forms/resume-suggestions-form";
import { SuggestionReviewForm } from "@/components/forms/suggestion-review-form";
import { TailoringStepper } from "@/components/tailoring-stepper";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getResumeSuggestionsDetail } from "@/lib/data/server";
import { hasWordDiff, wordDiff } from "@/lib/word-diff.mjs";

type ResumeSuggestionsPageProps = {
  params: Promise<{ matchId: string }>;
};

type SuggestionRow = {
  id: string;
  original_text?: string | null;
  suggested_text?: string;
  suggestion_type?: string;
  related_job_requirement?: string;
  evidence?: string;
  reason?: string;
  truth_guard_status?: string;
  user_action?: string;
  user_edited?: boolean | null;
};

type DiffSegment = { type: "same" | "removed" | "added"; text: string };

// Word-level diff vs the base resume text (US-061): removed words struck
// through, added words highlighted, so the user can judge a suggestion at a
// glance before accepting, editing, or rejecting it.
function SuggestionDiff({ original, suggested }: { original: string; suggested: string }) {
  const segments = wordDiff(original, suggested) as DiffSegment[];
  if (!hasWordDiff(segments)) {
    return null;
  }
  return (
    <p className="mt-2 rounded-md bg-muted/40 p-3 text-sm leading-6">
      {segments.map((segment, index) => (
        <span
          key={index}
          className={
            segment.type === "removed"
              ? "text-muted-foreground line-through decoration-destructive/60"
              : segment.type === "added"
                ? "rounded-sm bg-brand-muted px-0.5 font-medium"
                : undefined
          }
        >
          {segment.text}
          {index < segments.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

const TRUTH_SECTIONS: {
  status: string;
  title: string;
  description: string;
  variant: "success" | "warning" | "destructive";
}[] = [
  {
    status: "Safe to use",
    title: "Safe to use",
    description: "Supported by evidence already in your resume.",
    variant: "success",
  },
  {
    status: "Needs confirmation",
    title: "Needs confirmation",
    description: "Possibly true, but confirm before claiming it.",
    variant: "warning",
  },
  {
    status: "Do not use yet",
    title: "Do not use yet",
    description: "Would add experience the resume does not support — build proof first.",
    variant: "destructive",
  },
];

export default async function ResumeSuggestionsPage({ params }: ResumeSuggestionsPageProps) {
  const { matchId } = await params;
  const { match, suggestions, snapshot, draftSummary } =
    await getResumeSuggestionsDetail(matchId);
  const rows = (suggestions ?? []) as unknown as SuggestionRow[];
  const respondedCount = rows.filter((row) => (row.user_action ?? "pending") !== "pending").length;

  const strategy = typeof snapshot?.resume_strategy === "string" ? snapshot.resume_strategy : "";
  const assistantSummary =
    typeof snapshot?.assistant_summary === "string" ? snapshot.assistant_summary : "";
  const keywords = (
    Array.isArray(snapshot?.keywords_to_include) ? snapshot.keywords_to_include : []
  ) as { keyword?: string; status?: string }[];
  const doNotClaim = Array.isArray(snapshot?.do_not_claim)
    ? (snapshot.do_not_claim as unknown[]).map(String).filter(Boolean)
    : [];

  const keywordVariant: Record<string, "success" | "warning" | "destructive"> = {
    supported: "success",
    needs_confirmation: "warning",
    unsupported: "destructive",
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link
        href={`/matches/${match.id}`}
        className={buttonVariants({ variant: "ghost", className: "w-fit" })}
      >
        <ArrowLeft data-icon="inline-start" />
        Match report
      </Link>

      <TailoringStepper
        matchId={match.id}
        suggestionCount={rows.length}
        respondedCount={respondedCount}
        hasDraft={Boolean(draftSummary)}
        draftStatus={draftSummary?.status ?? null}
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
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
              Each suggestion carries a Truth Guard label so unsupported claims stay separate from
              wording already backed by resume evidence. Edit the text, then Accept or Reject — only
              accepted, supported suggestions shape the Tailored CV.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator</CardTitle>
            <CardDescription>
              {rows.length > 0
                ? `${rows.length} suggestion${rows.length === 1 ? "" : "s"} saved`
                : "Create the first suggestion set."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <ResumeSuggestionsForm matchId={match.id} />
              <Link
                href={`/matches/${match.id}/draft-cv`}
                className={buttonVariants({ variant: "outline" })}
              >
                Open Tailored CV
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {strategy || assistantSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI resume strategy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm leading-6 text-muted-foreground">
            {assistantSummary ? <p>{assistantSummary}</p> : null}
            {strategy ? <p>{strategy}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <section className="grid gap-5">
          {TRUTH_SECTIONS.map((section) => {
            const items = rows.filter((row) => row.truth_guard_status === section.status);
            if (items.length === 0) {
              return null;
            }
            return (
              <Card key={section.status}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant={section.variant}>{section.title}</Badge>
                    <CardTitle className="text-base">
                      {items.length} {items.length === 1 ? "suggestion" : "suggestions"}
                    </CardTitle>
                  </div>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {items.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {row.related_job_requirement || "Resume positioning"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {row.user_edited ? (
                            <Badge variant="secondary">Edited by you</Badge>
                          ) : null}
                          <Badge variant="outline">{row.suggestion_type || "suggestion"}</Badge>
                        </div>
                      </div>
                      {row.reason ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.reason}</p>
                      ) : null}
                      {row.evidence ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          <span className="font-medium text-foreground">Evidence:</span> {row.evidence}
                        </p>
                      ) : null}
                      {row.original_text ? (
                        <SuggestionDiff
                          original={row.original_text}
                          suggested={row.suggested_text ?? ""}
                        />
                      ) : null}
                      <div className="mt-3">
                        <SuggestionReviewForm
                          matchId={match.id}
                          suggestionId={row.id}
                          suggestedText={row.suggested_text ?? ""}
                          userAction={String(row.user_action ?? "pending")}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </section>
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

      {keywords.length > 0 || doNotClaim.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Keywords to include</CardTitle>
              <CardDescription>Only add keywords your resume can support.</CardDescription>
            </CardHeader>
            <CardContent>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw, index) => (
                    <Badge
                      key={`${kw.keyword}-${index}`}
                      variant={keywordVariant[String(kw.status)] ?? "outline"}
                    >
                      {kw.keyword ?? ""}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Claims to avoid</CardTitle>
              <CardDescription>Do not claim these without real evidence.</CardDescription>
            </CardHeader>
            <CardContent>
              {doNotClaim.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {doNotClaim.map((claim) => (
                    <Badge key={claim} variant="destructive">
                      {claim}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
