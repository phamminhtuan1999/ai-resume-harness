import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import { formatShortDate, getMatchDetail } from "@/lib/data/server";

type MatchDetailPageProps = {
  params: Promise<{ matchId: string }>;
};

type ListItem = Record<string, unknown>;

function asList(value: unknown): ListItem[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function itemText(item: ListItem) {
  return String(item.skill ?? item.risk ?? item.reason ?? item.evidence ?? "Analysis item");
}

function detailText(item: ListItem) {
  return String(
    item.reason ??
      item.evidence ??
      item.why_it_matters ??
      item.mitigation ??
      item.suggested_action ??
      ""
  );
}

function explanationCategory(value: unknown) {
  if (!value || typeof value !== "object" || !("category" in value)) {
    return "Generated analysis";
  }

  return String((value as { category: unknown }).category);
}

function AnalysisList({ empty, items }: { empty: string; items: ListItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="grid gap-3">
      {items.map((item, index) => (
        <li key={`${itemText(item)}-${index}`} className="rounded-lg border p-3">
          <p className="text-sm font-medium">{itemText(item)}</p>
          {detailText(item) ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{detailText(item)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { matchId } = await params;
  const { appUser, profile, match } = await getMatchDetail(matchId);

  const scoreRows = [
    ["Skill", match.skill_score],
    ["Experience", match.experience_score],
    ["AI readiness", match.ai_readiness_score],
    ["ATS keywords", match.ats_keyword_score],
    ["Seniority", match.seniority_score],
  ] as const;

  return (
    <AppShell
      active="Matches"
      userName={profile.full_name || appUser?.fullName}
      userTarget={profile.target_role}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Link href="/matches" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
          <ArrowLeft data-icon="inline-start" />
          Matches
        </Link>

        <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>
                    {match.jobs?.company || "Unknown company"} -{" "}
                    {match.jobs?.title || "Unknown role"}
                  </CardTitle>
                  <CardDescription>
                    {match.resumes?.title || "Unknown resume"} · Generated{" "}
                    {formatShortDate(match.created_at)}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{explanationCategory(match.explanation_json)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Overall score</span>
                  <span className="font-semibold">{match.overall_score}/100</span>
                </div>
                <Progress value={match.overall_score} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {scoreRows.map(([label, score]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span>{score}</span>
                    </div>
                    <Progress value={score} className="mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analysis basis</CardTitle>
              <CardDescription>Deterministic baseline parser for Period 2.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
              <p>
                This report uses saved canonical resume text and raw job description text. It does
                not invent missing resume evidence.
              </p>
              <Link
                href={`/matches/${match.id}/resume-suggestions`}
                className={buttonVariants({ variant: "outline" })}
              >
                Resume suggestions
              </Link>
              <Link
                href={`/matches/${match.id}/resume-draft`}
                className={buttonVariants({ variant: "outline" })}
              >
                Resume draft
              </Link>
              <Link
                href={`/matches/${match.id}/roadmap`}
                className={buttonVariants({ variant: "outline" })}
              >
                4-week roadmap
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Strengths</CardTitle>
              <CardDescription>Signals present in both the resume and job.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalysisList empty="No shared strengths found yet." items={asList(match.strengths_json)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weaknesses</CardTitle>
              <CardDescription>Areas that weaken positioning for this job.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalysisList empty="No weaknesses found." items={asList(match.weaknesses_json)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missing skills</CardTitle>
              <CardDescription>Gaps found in job requirements but not resume evidence.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalysisList
                empty="No missing skills found."
                items={asList(match.missing_skills_json)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risks</CardTitle>
              <CardDescription>Likely screening concerns and mitigation direction.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalysisList empty="No risks found." items={asList(match.risks_json)} />
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
