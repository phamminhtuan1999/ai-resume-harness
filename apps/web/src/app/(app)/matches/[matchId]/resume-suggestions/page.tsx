import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { ResumeSuggestionsForm } from "@/components/forms/resume-suggestions-form";
import { SuggestionCard } from "@/components/suggestions/suggestion-card";
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
import { CREDIT_ACTION_COSTS } from "@/lib/billing-credits.mjs";
import { getResumeSuggestionsDetail } from "@/lib/data/server";
import { hasStripeBillingEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

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

type TruthVariant = "success" | "warning" | "destructive";

const TRUTH_SECTIONS: {
  status: string;
  title: string;
  description: string;
  variant: TruthVariant;
}[] = [
  {
    status: "Safe to use",
    title: "Safe to use",
    description: "Backed by evidence already in your resume.",
    variant: "success",
  },
  {
    status: "Needs confirmation",
    title: "Needs confirmation",
    description: "Possibly true — confirm before claiming it.",
    variant: "warning",
  },
  {
    status: "Do not use yet",
    title: "Do not use yet",
    description: "Adds experience the resume can't support — build proof first.",
    variant: "destructive",
  },
];

const sectionDot: Record<TruthVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export default async function ResumeSuggestionsPage({ params }: ResumeSuggestionsPageProps) {
  const { matchId } = await params;
  const { match, suggestions, snapshot, draftSummary } =
    await getResumeSuggestionsDetail(matchId);
  const rows = (suggestions ?? []) as unknown as SuggestionRow[];
  const respondedCount = rows.filter((row) => (row.user_action ?? "pending") !== "pending").length;
  const acceptedCount = rows.filter((row) => row.user_action === "accepted").length;
  const allResponded = rows.length > 0 && respondedCount === rows.length;
  const progressPct = rows.length > 0 ? Math.round((respondedCount / rows.length) * 100) : 0;
  const cvCost = CREDIT_ACTION_COSTS.find((a) => a.id === "tailored_cv_generation")?.credits ?? 3;
  const showCreditCost = hasStripeBillingEnv();

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

  // Group by Truth Guard status, numbering suggestions continuously across
  // groups. Derive each group's starting number from the row counts of the
  // groups before it (no mutation during render — see react-hooks/immutability).
  const nonEmptySections = TRUTH_SECTIONS.map((section) => ({
    section,
    sectionRows: rows.filter((row) => row.truth_guard_status === section.status),
  })).filter((group) => group.sectionRows.length > 0);

  const groups = nonEmptySections.map((group, sectionIndex) => {
    const startIndex = nonEmptySections
      .slice(0, sectionIndex)
      .reduce((sum, prior) => sum + prior.sectionRows.length, 0);
    return {
      section: group.section,
      items: group.sectionRows.map((row, rowIndex) => ({
        row,
        index: startIndex + rowIndex + 1,
      })),
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <TailoringStepper
        matchId={match.id}
        suggestionCount={rows.length}
        respondedCount={respondedCount}
        hasDraft={Boolean(draftSummary)}
        draftStatus={draftSummary?.status ?? null}
      />

      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight">AI resume rewrites</h1>
            <p className="text-sm text-muted-foreground">
              {match.jobs?.company || "Unknown company"}
              <span className="px-1.5 text-border" aria-hidden>·</span>
              {match.jobs?.title || "Unknown role"}
              <span className="px-1.5 text-border" aria-hidden>·</span>
              {match.resumes?.title || "Resume"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2">
            <ResumeSuggestionsForm
              matchId={match.id}
              label={rows.length > 0 ? "Suggest more" : "Generate suggestions"}
              variant={rows.length > 0 ? "outline" : "default"}
            />
            {/* When every rewrite is reviewed, the "ready to build" banner below
                owns the Tailored CV CTA (it also shows the credit cost), so the
                header link is hidden to avoid a duplicate. */}
            {!allResponded ? (
              <Link
                href={`/matches/${match.id}/draft-cv`}
                className={buttonVariants({ variant: rows.length > 0 ? "default" : "outline" })}
              >
                Open Tailored CV
                <ArrowRight data-icon="inline-end" />
              </Link>
            ) : null}
          </div>
        </div>

        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Each rewrite carries a Truth Guard label, so unsupported claims stay separate from
          wording your resume already backs. Edit the text, then Accept or Reject — only accepted,
          supported rewrites shape your Tailored CV.
        </p>

        {/* Review progress */}
        {rows.length > 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 ring-1 ring-border">
            <p className="text-sm whitespace-nowrap">
              <span className="font-semibold tabular-nums">{respondedCount}</span>
              <span className="text-muted-foreground"> of {rows.length} reviewed</span>
              {acceptedCount > 0 ? (
                <span className="text-muted-foreground">
                  <span className="px-1.5 text-border" aria-hidden>·</span>
                  <span className="font-medium text-success tabular-nums">{acceptedCount}</span> accepted
                </span>
              ) : null}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{progressPct}%</span>
          </div>
        ) : null}
      </header>

      {/* All-reviewed banner */}
      {allResponded ? (
        <Card className="rise border-success/30 bg-success/[0.04]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-success" />
              <p className="text-sm font-medium">
                You&apos;ve reviewed all {rows.length} rewrite{rows.length === 1 ? "" : "s"}. Ready to
                build your Tailored CV.
              </p>
            </div>
            <Link href={`/matches/${match.id}/draft-cv`} className={buttonVariants({ size: "sm" })}>
              {draftSummary
                ? "Open Tailored CV"
                : showCreditCost
                  ? `Generate Tailored CV · ${cvCost} credits`
                  : "Generate Tailored CV"}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* AI strategy */}
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

      {/* Suggestions */}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-8">
          {groups.map(({ section, items }) => (
            <section key={section.status} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn("size-2 rounded-full", sectionDot[section.variant])} aria-hidden />
                <h2 className="font-heading text-sm font-semibold">{section.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {items.length}
                </span>
                <span className="text-xs text-muted-foreground">— {section.description}</span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map(({ row, index }) => (
                  <SuggestionCard
                    key={row.id}
                    matchId={match.id}
                    resumeId={match.resume_id ?? undefined}
                    suggestionId={row.id}
                    index={index}
                    suggestionType={row.suggestion_type || "suggestion"}
                    jobRequirement={row.related_job_requirement || "Resume positioning"}
                    truthLabel={section.title}
                    truthVariant={section.variant}
                    original={row.original_text ?? ""}
                    suggested={row.suggested_text ?? ""}
                    reason={row.reason ?? ""}
                    evidence={row.evidence ?? ""}
                    userAction={String(row.user_action ?? "pending")}
                    userEdited={Boolean(row.user_edited)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No rewrites yet</CardTitle>
            <CardDescription>
              Generate rewrites after reviewing the match score and missing skills.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Keywords / claims */}
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
