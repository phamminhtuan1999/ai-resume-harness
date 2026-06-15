import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { RadarChart } from "@/components/charts/radar-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  evidenceStatusLabel,
  profilePromptFromReasons,
} from "@/lib/analysis-package-view.mjs";
import type { AnalysisPackage } from "@/lib/data/server";

type DecisionEvidenceProps = {
  pkg: AnalysisPackage;
  matchId: string;
};

const SCORE_ROWS: [keyof AnalysisPackage["scores"], string][] = [
  ["skill", "Skill"],
  ["experience", "Experience"],
  ["ai_readiness", "AI readiness"],
  ["ats_keywords", "ATS keywords"],
  ["seniority", "Seniority"],
];

// The affordance must match the gap type (Truth Guard): a skill the user
// genuinely lacks routes to the gap plan — inviting "I have this" on a true
// gap nudges people to claim skills without evidence. Only proof/wording gaps
// link back to the profile.
function GapActionLink({ gap, matchId }: { gap: { gap_type?: string }; matchId: string }) {
  if (gap.gap_type === "true_gap") {
    return (
      <Link
        href={`/matches/${matchId}/gaps`}
        className="mt-1 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        See how to close this
      </Link>
    );
  }
  return (
    <Link
      href={`/profile?recheck=${matchId}`}
      className="mt-1 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
    >
      I have this — add it to my profile
    </Link>
  );
}

export function DecisionEvidence({ pkg, matchId }: DecisionEvidenceProps) {
  const decision = pkg.decision;
  const reasons = decision?.confidence.reasons ?? [];
  const { showProfileLink, showTargetRolePrompt } = profilePromptFromReasons(reasons);

  const matched = pkg.evidence.matched;
  // Prefer the richer skill_gaps detail; fall back to the snapshot's name list.
  const gaps = pkg.skill_gaps.length
    ? pkg.skill_gaps
    : pkg.evidence.missing.map((skill) => ({
        skill,
        importance: "critical",
        gap_type: "true_gap",
        evidence_status: "no_evidence",
        why_it_matters: "",
        how_to_fix: "",
        interview_risk: "",
      }));
  const risks = pkg.evidence.risks;

  // Same five categories the dashboard radar uses, so the breakdown reads
  // consistently across the app. Radar needs >=3 axes; fall back to bars below.
  const categoryBars = SCORE_ROWS.map(([key, label]) => ({
    label,
    value: Number(pkg.scores[key]) || 0,
  })).filter((b) => b.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="contents">Why ApplyWise thinks this</h2>
        </CardTitle>
        <CardDescription>The evidence behind the recommendation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Confidence — plain language only; the numeric % lives in Advanced. */}
        {decision?.confidence.qualitative ? (
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Info data-icon="inline-start" className="size-4" />
              {decision.confidence.qualitative}
            </p>
            {showTargetRolePrompt ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Set your target role so ApplyWise can tell whether this role is worth learning
                toward.
              </p>
            ) : null}
            {showProfileLink ? (
              <Link
                href={`/profile?recheck=${matchId}`}
                className="mt-2 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Update your profile
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Breakdown first: the at-a-glance summary of the "why"; the matched
            and missing lists below are its detail. */}
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Score breakdown</h3>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Overall match</span>
              <span className="font-semibold tabular-nums">{pkg.scores.overall}/100</span>
            </div>
            <Progress value={pkg.scores.overall} />
          </div>
          {categoryBars.length >= 3 ? (
            <div className="rounded-lg border bg-muted/20 py-2">
              <RadarChart data={categoryBars} />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {SCORE_ROWS.map(([key, label]) => (
                <div key={key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="tabular-nums">{pkg.scores[key]}</span>
                  </div>
                  <Progress value={Number(pkg.scores[key]) || 0} className="mt-2" />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" />
            What matches
          </h3>
          {matched.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence-backed strengths found yet.</p>
          ) : (
            <ul className="grid gap-2">
              {matched.map((item, index) => (
                <li key={`matched-${index}`} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.detail ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-warning" />
            {"What's missing"}
          </h3>
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No missing skills found.</p>
          ) : (
            <ul className="grid gap-2">
              {gaps.map((gap, index) => (
                <li key={`gap-${index}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{gap.skill}</p>
                    <Badge variant={gap.evidence_status === "weak_evidence" ? "warning" : "outline"}>
                      {evidenceStatusLabel(gap.evidence_status)}
                    </Badge>
                  </div>
                  {gap.why_it_matters ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{gap.why_it_matters}</p>
                  ) : null}
                  <GapActionLink gap={gap} matchId={matchId} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {risks.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Risks to weigh</h3>
            <ul className="grid gap-2">
              {risks.map((risk, index) => (
                <li key={`risk-${index}`} className="rounded-lg border p-3 text-sm leading-6">
                  {risk}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
