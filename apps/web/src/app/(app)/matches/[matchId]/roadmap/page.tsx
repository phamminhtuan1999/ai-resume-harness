import Link from "next/link";
import { ArrowLeft, CalendarCheck } from "lucide-react";

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

type RoadmapPageProps = {
  params: Promise<{ matchId: string }>;
};

type RoadmapWeek = {
  week: number;
  goal: string;
  skills_covered: string[];
  tasks: string[];
  deliverables: string[];
  suggested_project_work: string;
  resume_bullet_after_completion: string;
  priority: string;
};

type RoadmapJson = {
  target_role?: string;
  company?: string;
  source?: string;
  weeks?: RoadmapWeek[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asRoadmap(value: unknown): RoadmapJson {
  if (!value || typeof value !== "object") {
    return {};
  }

  const data = value as RoadmapJson;
  return {
    target_role: data.target_role,
    company: data.company,
    source: data.source,
    weeks: Array.isArray(data.weeks)
      ? data.weeks.map((week, index) => ({
          week: Number(week.week || index + 1),
          goal: String(week.goal || "Build stronger job-fit evidence."),
          skills_covered: asStringArray(week.skills_covered),
          tasks: asStringArray(week.tasks),
          deliverables: asStringArray(week.deliverables),
          suggested_project_work: String(week.suggested_project_work || ""),
          resume_bullet_after_completion: String(week.resume_bullet_after_completion || ""),
          priority: String(week.priority || "Medium"),
        }))
      : [],
  };
}

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
  const { profile, match, roadmaps } = await getRoadmapDetail(matchId);
  const latestRoadmap = roadmaps[0];
  const roadmap = asRoadmap(latestRoadmap?.roadmap_json);
  const weeks = roadmap.weeks ?? [];

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
                Roadmaps prioritize the highest-severity missing skills from the match report and
                turn them into weekly project work, deliverables, and resume evidence.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Score {match.overall_score}/100</Badge>
                <Badge variant="outline">{roadmap.source || "Baseline"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generator</CardTitle>
              <CardDescription>
                {latestRoadmap
                  ? `Latest roadmap ${formatShortDate(latestRoadmap.created_at)}`
                  : "Create the first roadmap."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoadmapForm matchId={match.id} />
            </CardContent>
          </Card>
        </section>

        {weeks.length > 0 ? (
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold">{latestRoadmap?.title}</h2>
              <p className="text-sm text-muted-foreground">
                {roadmap.target_role || profile.target_role || "Target role"} at{" "}
                {roadmap.company || match.jobs?.company || "target company"} · Saved{" "}
                {latestRoadmap ? formatShortDate(latestRoadmap.created_at) : ""}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {weeks.map((week) => (
                <Card key={week.week}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-base">Week {week.week}</CardTitle>
                        <CardDescription>{week.goal}</CardDescription>
                      </div>
                      <Badge variant={week.priority === "Critical" ? "warning" : "outline"}>
                        {week.priority}
                      </Badge>
                    </div>
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
                        <p className="font-medium">Project work</p>
                        <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                          {week.suggested_project_work || "No project work recorded."}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Resume bullet after completion</p>
                      <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                        {week.resume_bullet_after_completion || "No resume bullet recorded."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No roadmap yet</CardTitle>
              <CardDescription>
                Generate a roadmap after reviewing missing skills in the match report.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
  );
}
