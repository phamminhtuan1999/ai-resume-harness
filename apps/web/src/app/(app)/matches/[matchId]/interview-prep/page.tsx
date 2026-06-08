import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { InterviewPrepForm } from "@/components/forms/interview-prep-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getInterviewPrepDetail } from "@/lib/data/server";

type InterviewPrepPageProps = {
  params: Promise<{ matchId: string }>;
};

type Question = {
  category: string;
  question: string;
  focus: string;
  answer_framing: string;
  evidence: string;
  guardrail: string;
};

type WeakTopic = {
  topic: string;
  severity: string;
  why_it_matters: string;
  study_action: string;
  proof_to_build: string;
};

type StudyPlanItem = {
  phase: string;
  focus: string;
  tasks: string[];
};

type AnswerGuidance = {
  source?: string;
  opening_pitch?: string;
  evidence_to_use?: Array<{ topic: string; framing: string }>;
  topics_to_be_careful_with?: Array<{ topic: string; guidance: string }>;
  closing_questions?: string[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asQuestionList(value: unknown): Question[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const question = item as Question;
      return {
        category: String(question.category || "interview"),
        question: String(question.question || "Interview question"),
        focus: String(question.focus || "Interview focus"),
        answer_framing: String(question.answer_framing || "Use resume-backed evidence."),
        evidence: String(question.evidence || ""),
        guardrail: String(question.guardrail || "Avoid unsupported claims."),
      };
    });
}

function asQuestionGroups(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return [
    ["Technical", asQuestionList(source.technical)],
    ["AI/LLM", asQuestionList(source.ai_llm)],
    ["System design", asQuestionList(source.system_design)],
    ["Behavioral", asQuestionList(source.behavioral)],
  ] as const;
}

function asWeakTopics(value: unknown): WeakTopic[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const topic = item as WeakTopic;
      return {
        topic: String(topic.topic || "Interview topic"),
        severity: String(topic.severity || "Medium"),
        why_it_matters: String(topic.why_it_matters || "This topic may come up in interviews."),
        study_action: String(topic.study_action || "Study the topic before claiming depth."),
        proof_to_build: String(topic.proof_to_build || "Build proof before claiming experience."),
      };
    });
}

function asStudyPlan(value: unknown): StudyPlanItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const plan = item as StudyPlanItem;
      return {
        phase: String(plan.phase || "Prep phase"),
        focus: String(plan.focus || "Interview preparation"),
        tasks: asStringArray(plan.tasks),
      };
    });
}

function asAnswerGuidance(value: unknown): AnswerGuidance {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as AnswerGuidance;
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

export default async function InterviewPrepPage({ params }: InterviewPrepPageProps) {
  const { matchId } = await params;
  const { match, interviewPreps } = await getInterviewPrepDetail(matchId);
  const latestPrep = interviewPreps[0];
  const questionGroups = asQuestionGroups(latestPrep?.questions_json);
  const weakTopics = asWeakTopics(latestPrep?.weak_topics_json);
  const studyPlan = asStudyPlan(latestPrep?.study_plan_json);
  const answerGuidance = asAnswerGuidance(latestPrep?.answer_guidance_json);
  const hasPrep = Boolean(latestPrep);

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
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <CardTitle>Interview prep</CardTitle>
                  <CardDescription>
                    {match.jobs?.company || "Unknown company"} -{" "}
                    {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <p>
                Prep suggestions convert match analysis into likely interview questions, weak
                topics, study steps, and resume-grounded answer framing.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Score {match.overall_score}/100</Badge>
                <Badge variant="outline">{answerGuidance.source || "Baseline"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generator</CardTitle>
              <CardDescription>
                {latestPrep
                  ? `Latest prep ${formatShortDate(latestPrep.created_at)}`
                  : "Create the first interview prep set."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InterviewPrepForm matchId={match.id} />
            </CardContent>
          </Card>
        </section>

        {hasPrep ? (
          <section className="grid gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Answer strategy</CardTitle>
                <CardDescription>
                  Saved {formatShortDate(latestPrep.created_at)} for{" "}
                  {match.jobs?.title || "this role"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm leading-6">
                <div>
                  <p className="font-medium">Opening pitch</p>
                  <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                    {answerGuidance.opening_pitch || "No opening pitch generated."}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-medium">Evidence to use</p>
                    <div className="mt-2 grid gap-2">
                      {(answerGuidance.evidence_to_use ?? []).length > 0 ? (
                        (answerGuidance.evidence_to_use ?? []).map((item) => (
                          <div key={`${item.topic}-${item.framing}`} className="rounded-lg border p-3">
                            <p className="font-medium">{item.topic}</p>
                            <p className="text-muted-foreground">{item.framing}</p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                          No strong resume evidence was extracted for this prep set.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Careful topics</p>
                    <div className="mt-2 grid gap-2">
                      {(answerGuidance.topics_to_be_careful_with ?? []).length > 0 ? (
                        (answerGuidance.topics_to_be_careful_with ?? []).map((item) => (
                          <div key={`${item.topic}-${item.guidance}`} className="rounded-lg border p-3">
                            <p className="font-medium">{item.topic}</p>
                            <p className="text-muted-foreground">{item.guidance}</p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                          No careful topics were generated.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-2">
              {questionGroups.map(([label, questions]) => (
                <Card key={label}>
                  <CardHeader>
                    <CardTitle className="text-base">{label} questions</CardTitle>
                    <CardDescription>{questions.length} suggested prompts</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {questions.map((question) => (
                      <div key={question.question} className="rounded-lg border p-3 text-sm leading-6">
                        <p className="font-medium">{question.question}</p>
                        <p className="mt-1 text-muted-foreground">{question.answer_framing}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{question.focus}</Badge>
                          <Badge variant="secondary">{question.guardrail}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <CardTitle>Weak topics</CardTitle>
                  <CardDescription>Study or proof needed before claiming depth.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {weakTopics.map((topic) => (
                    <div key={topic.topic} className="rounded-lg border p-3 text-sm leading-6">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium">{topic.topic}</p>
                          <p className="text-muted-foreground">{topic.why_it_matters}</p>
                        </div>
                        <Badge variant={topic.severity === "Critical" ? "warning" : "outline"}>
                          {topic.severity}
                        </Badge>
                      </div>
                      <p className="mt-3 text-muted-foreground">{topic.study_action}</p>
                      <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                        {topic.proof_to_build}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Study plan</CardTitle>
                  <CardDescription>Compact prep sequence for this match.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {studyPlan.map((item) => (
                    <div key={item.phase} className="text-sm leading-6">
                      <p className="font-medium">
                        {item.phase}: {item.focus}
                      </p>
                      <div className="mt-2">
                        <TextList items={item.tasks} />
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-sm font-medium">Closing questions</p>
                    <div className="mt-2">
                      <TextList items={asStringArray(answerGuidance.closing_questions)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </section>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No interview prep yet</CardTitle>
              <CardDescription>
                Generate prep after reviewing the match report, missing skills, and risks.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
  );
}
