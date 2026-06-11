import { Sparkles } from "lucide-react";

import { RegenerateMatchForm } from "@/components/forms/regenerate-match-form";
import { AnalysisNotices } from "@/components/matches/analysis-notices";
import { DecisionEvidence } from "@/components/matches/decision-evidence";
import { DecisionHeader } from "@/components/matches/decision-header";
import { DecisionRecommendation } from "@/components/matches/decision-recommendation";
import { NextActionsPanel } from "@/components/matches/next-actions-panel";
import { RoadmapEntryCard } from "@/components/matches/roadmap-entry-card";
import { EmptyState } from "@/components/empty-state";
import { getAnalysisPackage, getMatchAiWorkflowRuns, getMatchDetail } from "@/lib/data/server";
import { roadmapEntryFromRuns } from "@/lib/analysis-package-view.mjs";
import { isCoreChainRunning } from "@/lib/refresh-view.mjs";

type MatchDetailPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { matchId } = await params;
  const [{ match }, aiWorkflow, packageResult] = await Promise.all([
    getMatchDetail(matchId),
    getMatchAiWorkflowRuns(matchId),
    getAnalysisPackage(matchId),
  ]);

  const pkg = packageResult.ok ? packageResult.package : null;
  const coreChainRunning = isCoreChainRunning(aiWorkflow.runs);
  const roadmapEntry = roadmapEntryFromRuns(aiWorkflow.runs);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* Decision-first overview (US-048): one verdict, why, and what next. The
          tab shell + back affordance live in the route layout (US-051); the AI
          workflow panel now lives behind the Advanced tab. */}
      {pkg && pkg.decision ? (
        <>
          <DecisionHeader pkg={pkg} matchId={match.id} coreChainRunning={coreChainRunning} />
          <AnalysisNotices pkg={pkg} matchId={match.id} />
          <DecisionRecommendation decision={pkg.decision} evidence={pkg.evidence} />
          {roadmapEntry ? (
            <RoadmapEntryCard matchId={match.id} generatedAt={roadmapEntry.generatedAt} />
          ) : null}
        </>
      ) : pkg ? (
        <EmptyState
          variant="create"
          icon={Sparkles}
          title="This job hasn't been analyzed yet"
          description="Run the analysis to see whether to apply, why, and what to do next."
          action={<RegenerateMatchForm matchId={match.id} />}
        />
      ) : (
        <EmptyState
          variant="error"
          title="We couldn't load the latest assessment"
          description={packageResult.ok ? "No analysis is available yet." : packageResult.message}
          action={<RegenerateMatchForm matchId={match.id} />}
        />
      )}

      {/* Evidence + recommendation-driven actions (US-048 / US-049). On mobile
          the actions sit directly beneath the recommendation; on desktop the
          evidence takes the wide column and the actions the rail. */}
      {pkg && pkg.decision ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="order-2 flex flex-col gap-5 lg:order-1">
            <DecisionEvidence pkg={pkg} matchId={match.id} />
          </div>
          <div className="order-1 lg:order-2">
            <NextActionsPanel pkg={pkg} matchId={match.id} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
