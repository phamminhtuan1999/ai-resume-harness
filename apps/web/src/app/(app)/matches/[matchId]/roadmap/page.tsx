import Link from "next/link";
import { ArrowLeft, CalendarCheck, Lightbulb } from "lucide-react";

import { RoadmapForm } from "@/components/forms/roadmap-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getRoadmapDetail } from "@/lib/data/server";
import { normalizeRoadmap, resumeBullets } from "@/lib/roadmap-view.mjs";

type RoadmapPageProps = {
  params: Promise<{ matchId: string }>;
};

type ViewWeek = {
  week: number;
  goal: string;
  skills_covered: string[];
  tasks: string[];
  deliverables: string[];
  project_feature: string;
  resume_bullet_after_completion: string;
  interview_talking_point: string;
};

type ViewRoadmap = {
  roadmap_summary: string;
  recommended_project_theme: string;
  weeks: ViewWeek[];
  success_criteria: string[];
  confidence_score: number | null;
  target_role: string;
  company: string;
  is_legacy: boolean;
};

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No items recorded.</p>;
  }

  return (
    <ul className="grid gap-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function RoadmapPage({ params }: RoadmapPageProps) {
  const { matchId } = await params;
  const { profile, match, roadmaps, hasGapAnalysis, roadmapRun } =
    await getRoadmapDetail(matchId);
  const latestRoadmap = roadmaps[0];
  const roadmap = normalizeRoadmap(latestRoadmap?.roadmap_json) as ViewRoadmap;
  const weeks = roadmap.weeks ?? [];
  const bullets = resumeBullets(weeks) as { week: number; bullet: string }[];
  const needsReview = roadmapRun?.status === "needs_review";

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
                <CalendarCheck className="size-4" />
              </div>
              <div>
                <CardTitle>4-week improvement roadmap</CardTitle>
                <CardDescription>
                  {match.jobs?.company || "Unknown company"} -{" "}
                  {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>
              {roadmap.roadmap_summary ||
                "Roadmaps close the most critical gaps from your skill gap analysis with weekly project work, deliverables, and future-use resume evidence."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Score {match.overall_score}/100</Badge>
              {roadmapRun?.model_provider ? (
                <Badge variant="outline">
                  {roadmapRun.model_provider === "gemini" ? "AI generated" : "Baseline"}
                </Badge>
              ) : null}
              {needsReview ? <Badge variant="warning">Needs review</Badge> : null}
            </div>
            {needsReview ? (
              <p className="text-sm">
                This roadmap may need a closer look before following it.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator</CardTitle>
            <CardDescription>
              {latestRoadmap
                ? `Saved ${formatShortDate(latestRoadmap.updated_at ?? latestRoadmap.created_at)}`
                : "Create the first roadmap."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {hasGapAnalysis ? (
              <RoadmapForm matchId={match.id} hasExisting={Boolean(latestRoadmap)} />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Run gap analysis first — the roadmap uses your missing skill analysis as
                input.{" "}
                <Link className="font-medium text-foreground underline" href={`/matches/${match.id}/gaps`}>
                  Analyze skill gaps
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {weeks.length > 0 ? (
        <>
          {roadmap.recommended_project_theme ? (
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                    <Lightbulb className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Recommended project theme</CardTitle>
                    <CardDescription>
                      One coherent project to extend across all 4 weeks.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6">{roadmap.recommended_project_theme}</p>
              </CardContent>
            </Card>
          ) : null}

          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold">{latestRoadmap?.title}</h2>
              <p className="text-sm text-muted-foreground">
                {roadmap.target_role || profile.target_role || "Target role"} at{" "}
                {roadmap.company || match.jobs?.company || "target company"} · Saved{" "}
                {latestRoadmap
                  ? formatShortDate(latestRoadmap.updated_at ?? latestRoadmap.created_at)
                  : ""}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {weeks.map((week) => (
                <Card key={week.week}>
                  <CardHeader>
                    <CardTitle className="text-base">Week {week.week}</CardTitle>
                    <CardDescription>{week.goal}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 text-sm leading-6">
                    <div>
                      <p className="font-medium">Skills covered</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {week.skills_covered.map((skill) => (
                          <Badge key={skill} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Tasks</p>
                      <div className="mt-2">
                        <TextList items={week.tasks} />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="font-medium">Deliverables</p>
                        <div className="mt-2">
                          <TextList items={week.deliverables} />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium">Project feature</p>
                        <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                          {week.project_feature || "No project feature recorded."}
                        </p>
                      </div>
                    </div>
                    {week.resume_bullet_after_completion ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Resume bullet</p>
                          <Badge variant="outline">Use after completion</Badge>
                        </div>
                        <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                          {week.resume_bullet_after_completion}
                        </p>
                      </div>
                    ) : null}
                    {week.interview_talking_point ? (
                      <div>
                        <p className="font-medium">Interview talking point</p>
                        <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                          {week.interview_talking_point}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {roadmap.success_criteria.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Success criteria</CardTitle>
                <CardDescription>
                  Observable outcomes you can verify at the end of week 4.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TextList items={roadmap.success_criteria} />
              </CardContent>
            </Card>
          ) : null}

          {bullets.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Resume bullets after completion</CardTitle>
                  <Badge variant="outline">Use after completion</Badge>
                </div>
                <CardDescription>
                  Add these only after honestly completing each week&apos;s work — they are
                  not current experience.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2">
                  {bullets.map((item) => (
                    <li
                      key={item.week}
                      className="rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6"
                    >
                      <span className="font-medium">Week {item.week}:</span> {item.bullet}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No roadmap yet</CardTitle>
            <CardDescription>
              {hasGapAnalysis
                ? "Generate a roadmap to turn your skill gap analysis into a 4-week plan."
                : "Run the match report and gap analysis first, then generate a roadmap."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
