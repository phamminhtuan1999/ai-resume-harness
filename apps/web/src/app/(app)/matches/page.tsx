import Link from "next/link";
import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortDate, getMatchesList } from "@/lib/data/server";
import {
  ANALYZED_JOBS_LABEL,
  matchListScore,
  matchListVerdict,
} from "@/lib/matches-list-view.mjs";

type BadgeVariant = "success" | "info" | "warning" | "destructive";

// Legacy score-derived badge for never-recomputed matches only (decision 0015
// §10 — a match with a decision snapshot shows the decision label instead).
const RECOMMENDATION_META: Record<string, { label: string; variant: BadgeVariant }> = {
  apply_now: { label: "Apply now", variant: "success" },
  apply_with_improvements: { label: "Apply with improvements", variant: "info" },
  improve_first: { label: "Improve first", variant: "warning" },
  not_recommended: { label: "Not recommended", variant: "destructive" },
};

function scoreVariant(score: number): BadgeVariant {
  if (score >= 75) return "success";
  if (score >= 60) return "info";
  if (score >= 40) return "warning";
  return "destructive";
}

export default async function MatchesPage() {
  const { matches } = await getMatchesList();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        actions={
          <Link href="/matches/new" className={buttonVariants({ size: "lg" })}>
            Analyze a job
          </Link>
        }
        description="Every job you've analyzed, most recent first. Each row shows the verdict and match score."
        title={ANALYZED_JOBS_LABEL}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your analyzed jobs</CardTitle>
          <CardDescription>
            {matches.length > 0
              ? "Latest analyses, newest first."
              : "Analyzed jobs appear here after you compare a resume and job."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead className="text-right">Analyzed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => {
                  const score = matchListScore(match.decision?.match_score, match.overall_score) ?? 0;
                  // Prefer the decision snapshot's verdict (same vocabulary as the
                  // detail page); fall back to the legacy badge only when a match
                  // has never been recomputed.
                  const verdict = matchListVerdict(match.decision?.label);
                  const legacy = match.apply_recommendation
                    ? RECOMMENDATION_META[match.apply_recommendation]
                    : null;
                  const needsReview =
                    typeof match.confidence_score === "number" && match.confidence_score < 0.5;

                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        <Link href={`/matches/${match.id}`} className="hover:underline">
                          {match.jobs?.company || "Unknown company"} -{" "}
                          {match.jobs?.title || "Unknown role"}
                        </Link>
                      </TableCell>
                      <TableCell>{match.resumes?.title || "Unknown resume"}</TableCell>
                      <TableCell>
                        <Badge variant={scoreVariant(score)}>{score}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {verdict ? (
                            <Badge variant={verdict.variant}>{verdict.display}</Badge>
                          ) : legacy ? (
                            <Badge variant={legacy.variant}>{legacy.label}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                          {needsReview ? <Badge variant="warning">Needs review</Badge> : null}
                          {match.is_stale ? <Badge variant="outline">Out of date</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatShortDate(match.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              variant="create"
              action={
                <Link href="/matches/new" className={buttonVariants({ variant: "outline" })}>
                  Analyze a job
                </Link>
              }
              description="Analyze a job after saving a resume and job description."
              icon={ListChecks}
              title="No analyzed jobs yet"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
