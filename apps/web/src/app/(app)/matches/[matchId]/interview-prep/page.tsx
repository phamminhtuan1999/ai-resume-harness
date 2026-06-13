import { AlertTriangle } from "lucide-react";

import { InterviewPrepForm } from "@/components/forms/interview-prep-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatShortDate, getInterviewPrepDetail } from "@/lib/data/server";
import { normalizeInterviewPrep } from "@/lib/interview-prep-view.mjs";

type InterviewPrepPageProps = {
  params: Promise<{ matchId: string }>;
};

type GuidanceItem = {
  question: string;
  recommended_angle: string;
  resume_evidence_to_use: string | null;
  warning: string | null;
};

type PrepView = {
  is_legacy: boolean;
  prep_summary: string;
  technical_questions: string[];
  ai_llm_questions: string[];
  system_design_questions: string[];
  behavioral_questions: string[];
  weak_topics_to_study: string[];
  answer_guidance: GuidanceItem[];
};

function QuestionList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No questions recorded.</p>;
  }
  return (
    <ul className="grid gap-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6">
          {item}
        </li>
      ))}
    </ul>
  );
}

function GuidanceCard({ item }: { item: GuidanceItem }) {
  return (
    <li className="rounded-lg border p-4 text-sm leading-6">
      <p className="font-semibold">{item.question}</p>
      {item.recommended_angle ? (
        <p className="mt-2 text-muted-foreground">
          <span className="font-medium text-foreground">Recommended angle:</span>{" "}
          {item.recommended_angle}
        </p>
      ) : null}
      {item.resume_evidence_to_use ? (
        <p className="mt-2 text-muted-foreground">
          <span className="font-medium text-foreground">Resume evidence:</span>{" "}
          {item.resume_evidence_to_use}
        </p>
      ) : (
        <p className="mt-2 text-muted-foreground">No evidence found</p>
      )}
      {item.warning ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-warning/16 px-3 py-2">
          <AlertTriangle className="mt-1 size-4 shrink-0 text-[oklch(0.45_0.09_70)] dark:text-[oklch(0.85_0.13_82)]" />
          <p>
            <Badge variant="warning">Warning</Badge>{" "}
            <span className="text-[oklch(0.45_0.09_70)] dark:text-[oklch(0.85_0.13_82)]">
              {item.warning}
            </span>
          </p>
        </div>
      ) : null}
    </li>
  );
}

export default async function InterviewPrepPage({ params }: InterviewPrepPageProps) {
  const { matchId } = await params;
  const { match, interviewPreps, prepRun } = await getInterviewPrepDetail(matchId);
  const latestPrep = interviewPreps[0];
  const prep = normalizeInterviewPrep(latestPrep) as PrepView;
  const hasPrep = Boolean(latestPrep);
  const needsReview = prepRun?.status === "needs_review";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Interview prep</CardTitle>
            <CardDescription>
              {match.jobs?.company || "Unknown company"} -{" "}
              {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>
              {prep.prep_summary ||
                "Interview prep converts your match, gap, and resume analysis into job-specific questions, weak topics, and honest answer guidance."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Score {match.overall_score}/100</Badge>
              {prepRun?.model_provider ? (
                <Badge variant="outline">
                  {prepRun.model_provider === "gemini" ? "AI generated" : "Baseline"}
                </Badge>
              ) : null}
              {needsReview ? <Badge variant="warning">Needs review</Badge> : null}
            </div>
            {needsReview ? (
              <p className="text-sm">
                This prep set may need a closer look before relying on it.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator</CardTitle>
            <CardDescription>
              {latestPrep
                ? `Saved ${formatShortDate(latestPrep.updated_at ?? latestPrep.created_at)}`
                : "Create the first interview prep set."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InterviewPrepForm matchId={match.id} hasExisting={hasPrep} />
          </CardContent>
        </Card>
      </section>

      {hasPrep ? (
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="technical">Technical</TabsTrigger>
                <TabsTrigger value="ai-llm">AI/LLM</TabsTrigger>
                <TabsTrigger value="system-design">System Design</TabsTrigger>
                <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
                <TabsTrigger value="weak-topics">Weak Topics</TabsTrigger>
                <TabsTrigger value="answer-guidance">Answer Guidance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="grid gap-3 text-sm leading-6">
                <p>{prep.prep_summary || "No prep summary recorded."}</p>
                <div className="flex flex-wrap gap-2">
                  {prepRun?.model_provider ? (
                    <Badge variant="outline">
                      {prepRun.model_provider === "gemini" ? "AI generated" : "Baseline"}
                    </Badge>
                  ) : null}
                  {typeof prepRun?.confidence_score === "number" ? (
                    <Badge variant="secondary">
                      Confidence {Math.round(prepRun.confidence_score * 100)}%
                    </Badge>
                  ) : null}
                  {needsReview ? <Badge variant="warning">Needs review</Badge> : null}
                </div>
                {prep.weak_topics_to_study.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-medium text-foreground">Study first:</span>
                    {prep.weak_topics_to_study.slice(0, 3).map((topic) => (
                      <Badge key={topic} variant="warning">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="technical">
                <QuestionList items={prep.technical_questions} />
              </TabsContent>
              <TabsContent value="ai-llm">
                <QuestionList items={prep.ai_llm_questions} />
              </TabsContent>
              <TabsContent value="system-design">
                <QuestionList items={prep.system_design_questions} />
              </TabsContent>
              <TabsContent value="behavioral">
                <QuestionList items={prep.behavioral_questions} />
              </TabsContent>
              <TabsContent value="weak-topics">
                <QuestionList items={prep.weak_topics_to_study} />
              </TabsContent>
              <TabsContent value="answer-guidance">
                {prep.answer_guidance.length > 0 ? (
                  <ul className="grid gap-3">
                    {prep.answer_guidance.map((item, index) => (
                      <GuidanceCard key={`${item.question}-${index}`} item={item} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No answer guidance recorded.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No interview prep yet</CardTitle>
            <CardDescription>
              Generate prep after the match report to see job-specific questions, weak
              topics, and answer guidance.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
