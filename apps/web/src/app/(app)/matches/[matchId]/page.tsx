import Link from "next/link";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";

import { AssistantInsightForm } from "@/components/forms/assistant-insight-form";
import { RegenerateMatchForm } from "@/components/forms/regenerate-match-form";
import { SaveApplicationForm } from "@/components/forms/save-application-form";
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
import { AiWorkflowPanel } from "@/components/ai-workflow-panel";
import {
  formatShortDate,
  getMatchAiWorkflowRuns,
  getMatchDetail,
  type WorkspaceMatch,
} from "@/lib/data/server";

type MatchDetailPageProps = {
  params: Promise<{ matchId: string }>;
};

type Strength = {
  strength: string;
  resume_evidence?: string;
  job_requirement?: string;
  why_it_matters?: string;
};

type Gap = {
  gap: string;
  gap_type?: string;
  job_requirement?: string;
  why_it_matters?: string;
  suggested_action?: string;
};

const RECOMMENDATION_META: Record<
  string,
  { label: string; variant: "success" | "info" | "warning" | "destructive" }
> = {
  apply_now: { label: "Apply now", variant: "success" },
  apply_with_improvements: { label: "Apply with improvements", variant: "info" },
  improve_first: { label: "Improve first", variant: "warning" },
  not_recommended: { label: "Not recommended", variant: "destructive" },
};

const GAP_TYPE_LABEL: Record<string, string> = {
  true_gap: "True gap",
  wording_gap: "Wording gap",
  proof_gap: "Proof gap",
};

const INSIGHT_RECOMMENDATION_META: Record<
  string,
  { label: string; variant: "success" | "info" | "warning" | "secondary" }
> = {
  apply_now: { label: "Apply now", variant: "success" },
  tailor_resume_first: { label: "Tailor resume first", variant: "info" },
  build_project_first: { label: "Build project first", variant: "warning" },
  low_priority: { label: "Low priority", variant: "secondary" },
};

const RISK_META: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  low: { label: "Low risk", variant: "success" },
  medium: { label: "Medium risk", variant: "warning" },
  high: { label: "High risk", variant: "destructive" },
};

function asObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Prefer the structured Period 8 columns; fall back to the legacy columns so
// matches generated before US-028 still render.
function parseStrengths(match: WorkspaceMatch): Strength[] {
  const structured = asObjects(match.top_strengths_json);
  if (structured.length > 0) {
    return structured
      .map((item) => ({
        strength: str(item.strength),
        resume_evidence: str(item.resume_evidence),
        job_requirement: str(item.job_requirement),
        why_it_matters: str(item.why_it_matters),
      }))
      .filter((s) => s.strength);
  }
  return asObjects(match.strengths_json)
    .map((item) => ({ strength: str(item.skill), resume_evidence: str(item.evidence) }))
    .filter((s) => s.strength);
}

function parseGaps(match: WorkspaceMatch): Gap[] {
  const structured = asObjects(match.top_gaps_json);
  if (structured.length > 0) {
    return structured
      .map((item) => ({
        gap: str(item.gap),
        gap_type: str(item.gap_type) || "true_gap",
        job_requirement: str(item.job_requirement),
        why_it_matters: str(item.why_it_matters),
        suggested_action: str(item.suggested_action),
      }))
      .filter((g) => g.gap);
  }
  return asObjects(match.missing_skills_json)
    .map((item) => ({
      gap: str(item.skill),
      gap_type: str(item.gap_type).toLowerCase().includes("wording") ? "wording_gap" : "true_gap",
      why_it_matters: str(item.why_it_matters),
      suggested_action: str(item.suggested_action),
    }))
    .filter((g) => g.gap);
}

function isWordingGap(gap: Gap): boolean {
  const type = (gap.gap_type ?? "").toLowerCase();
  return type.includes("wording") || type.includes("proof");
}

function StrengthList({ items }: { items: Strength[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence-backed strengths found yet.</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.map((item, index) => (
        <li key={`${item.strength}-${index}`} className="rounded-lg border p-3">
          <p className="text-sm font-medium">{item.strength}</p>
          {item.resume_evidence ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">Evidence:</span> {item.resume_evidence}
            </p>
          ) : null}
          {item.why_it_matters ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.why_it_matters}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function GapList({ empty, items }: { empty: string; items: Gap[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.map((item, index) => (
        <li key={`${item.gap}-${index}`} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{item.gap}</p>
            {item.gap_type ? (
              <Badge variant="outline">{GAP_TYPE_LABEL[item.gap_type] ?? item.gap_type}</Badge>
            ) : null}
          </div>
          {item.why_it_matters ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.why_it_matters}</p>
          ) : null}
          {item.suggested_action ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">Suggested:</span> {item.suggested_action}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { matchId } = await params;
  const [{ match, insight }, aiWorkflow] = await Promise.all([
    getMatchDetail(matchId),
    getMatchAiWorkflowRuns(matchId),
  ]);

  const scoreExplanations =
    match.score_explanations_json && typeof match.score_explanations_json === "object"
      ? (match.score_explanations_json as Record<string, unknown>)
      : {};

  const scoreRows = [
    ["Skill", match.skill_score, str(scoreExplanations.skill)],
    ["Experience", match.experience_score, str(scoreExplanations.experience)],
    ["AI readiness", match.ai_readiness_score, str(scoreExplanations.ai_readiness)],
    ["ATS keywords", match.ats_keyword_score, str(scoreExplanations.ats_keyword)],
    ["Seniority", match.seniority_score, str(scoreExplanations.seniority)],
  ] as const;

  const strengths = parseStrengths(match);
  const gaps = parseGaps(match);
  const trueGaps = gaps.filter((gap) => !isWordingGap(gap));
  const wordingGaps = gaps.filter(isWordingGap);
  const risks = asObjects(match.risks_json);

  const insightRecommendation =
    insight?.recommendation && INSIGHT_RECOMMENDATION_META[insight.recommendation]
      ? INSIGHT_RECOMMENDATION_META[insight.recommendation]
      : null;
  const insightRisk = insight?.risk_level ? RISK_META[insight.risk_level] : null;

  const recommendation = match.apply_recommendation
    ? RECOMMENDATION_META[match.apply_recommendation]
    : null;
  const confidencePct =
    typeof match.confidence_score === "number"
      ? Math.round(match.confidence_score * 100)
      : null;
  const needsReview = typeof match.confidence_score === "number" && match.confidence_score < 0.5;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link href="/matches" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
        <ArrowLeft data-icon="inline-start" />
        Matches
      </Link>

      {match.is_stale ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Badge variant="warning">Out of date</Badge>
              <div>
                <p className="text-sm font-medium">This analysis may be out of date</p>
                <p className="text-sm text-muted-foreground">
                  The resume or job changed after this report was generated. Regenerate for current
                  results.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <RegenerateMatchForm matchId={match.id} />
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                <Lightbulb className="size-4" />
              </div>
              <div>
                <CardTitle>AI job assistant</CardTitle>
                <CardDescription>
                  What ApplyWise recommends you do about this role.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {insightRecommendation ? (
                <Badge variant={insightRecommendation.variant}>{insightRecommendation.label}</Badge>
              ) : null}
              {insightRisk ? <Badge variant={insightRisk.variant}>{insightRisk.label}</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {insight ? (
            <>
              {insight.assistant_summary ? (
                <p className="text-sm leading-6">{insight.assistant_summary}</p>
              ) : null}
              {insight.why_this_recommendation ? (
                <div>
                  <p className="text-sm font-medium">Why this recommendation</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {insight.why_this_recommendation}
                  </p>
                </div>
              ) : null}
              {insight.next_best_action ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-medium">Next best action</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {insight.next_best_action}
                  </p>
                </div>
              ) : null}
              {insight.application_strategy ? (
                <div>
                  <p className="text-sm font-medium">Application strategy</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {insight.application_strategy}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Generate a decision-oriented recommendation: whether to apply now, tailor your resume,
              build a project first, or deprioritize — with a strategy and risk level.
            </p>
          )}
          <div className="max-w-xs">
            <AssistantInsightForm matchId={match.id} hasExisting={Boolean(insight)} />
          </div>
        </CardContent>
      </Card>

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
              <div className="flex flex-col items-start gap-2 md:items-end">
                {recommendation ? (
                  <Badge variant={recommendation.variant}>{recommendation.label}</Badge>
                ) : null}
                {needsReview ? <Badge variant="warning">Needs review</Badge> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {match.assistant_summary ? (
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles data-icon="inline-start" className="size-4" />
                  AI assistant summary
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {match.assistant_summary}
                </p>
                {match.fit_reasoning ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{match.fit_reasoning}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Overall score</span>
                <span className="font-semibold">{match.overall_score}/100</span>
              </div>
              <Progress value={match.overall_score} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {scoreRows.map(([label, score, explanation]) => (
                <div key={label} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span>{score}</span>
                  </div>
                  <Progress value={Number(score) || 0} className="mt-2" />
                  {explanation ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{explanation}</p>
                  ) : null}
                </div>
              ))}
            </div>

            {match.next_best_action ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">Next best action</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {match.next_best_action}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis basis</CardTitle>
            <CardDescription>
              {match.analyzer_provider === "gemini"
                ? "Generated by the AI assistant from your resume and the job."
                : "Generated from saved resume and job text."}
              {confidencePct !== null ? ` Confidence ${confidencePct}%.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
            <p>
              This report uses saved canonical resume text and raw job description text. It does not
              invent missing resume evidence.
            </p>
            <RegenerateMatchForm matchId={match.id} />
            {match.job_id ? <SaveApplicationForm jobId={match.job_id} matchId={match.id} /> : null}
            <Link
              href={`/matches/${match.id}/gaps`}
              className={buttonVariants({ variant: "outline" })}
            >
              Skill gap analysis
            </Link>
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
              href={`/matches/${match.id}/cover-letter`}
              className={buttonVariants({ variant: "outline" })}
            >
              Cover letter
            </Link>
            <Link
              href={`/matches/${match.id}/roadmap`}
              className={buttonVariants({ variant: "outline" })}
            >
              4-week roadmap
            </Link>
            <Link
              href={`/matches/${match.id}/interview-prep`}
              className={buttonVariants({ variant: "outline" })}
            >
              Interview prep
            </Link>
          </CardContent>
        </Card>
      </section>

      <AiWorkflowPanel
        matchId={match.id}
        runs={aiWorkflow.runs}
        profileReady={aiWorkflow.profileReady}
        jobImported={aiWorkflow.jobImported}
        jobParsed={aiWorkflow.jobParsed}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Why you match</CardTitle>
            <CardDescription>Strengths backed by evidence in your resume.</CardDescription>
          </CardHeader>
          <CardContent>
            <StrengthList items={strengths} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is missing</CardTitle>
            <CardDescription>Job requirements without resume evidence.</CardDescription>
          </CardHeader>
          <CardContent>
            <GapList empty="No missing skills found." items={trueGaps} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume wording gaps</CardTitle>
            <CardDescription>Skills you likely have but the resume does not surface.</CardDescription>
          </CardHeader>
          <CardContent>
            <GapList
              empty="No wording gaps found."
              items={wordingGaps}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risks</CardTitle>
            <CardDescription>Likely screening concerns and mitigation direction.</CardDescription>
          </CardHeader>
          <CardContent>
            {risks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No risks found.</p>
            ) : (
              <ul className="grid gap-3">
                {risks.map((item, index) => (
                  <li key={`risk-${index}`} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{str(item.risk) || "Risk"}</p>
                    {str(item.mitigation) ? (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {str(item.mitigation)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
