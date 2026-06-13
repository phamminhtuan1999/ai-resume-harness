import { Sparkles } from "lucide-react";

import { RegenerateMatchForm } from "@/components/forms/regenerate-match-form";
import { AnalysisNotices } from "@/components/matches/analysis-notices";
import { DecisionEvidence } from "@/components/matches/decision-evidence";
import { DecisionHeader } from "@/components/matches/decision-header";
import { DecisionRecommendation } from "@/components/matches/decision-recommendation";
import { NextActionsPanel } from "@/components/matches/next-actions-panel";
import { RoadmapEntryCard } from "@/components/matches/roadmap-entry-card";
import { EmptyState } from "@/components/empty-state";
import { hasEnoughCredits } from "@/lib/billing-ledger";
import {
  getAnalysisPackage,
  getMatchAiWorkflowRuns,
  getMatchDetail,
  getWorkspaceProfile,
} from "@/lib/data/server";
import { roadmapEntryFromRuns } from "@/lib/analysis-package-view.mjs";
import { isCoreChainRunning } from "@/lib/refresh-view.mjs";

type MatchDetailPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { matchId } = await params;
  const [{ match }, aiWorkflow, packageResult, { profile }] = await Promise.all([
    getMatchDetail(matchId),
    getMatchAiWorkflowRuns(matchId),
    getAnalysisPackage(matchId),
    getWorkspaceProfile(),
  ]);

  const pkg = packageResult.ok ? packageResult.package : null;
  const coreChainRunning = isCoreChainRunning(aiWorkflow.runs);
  const roadmapEntry = roadmapEntryFromRuns(aiWorkflow.runs);

  // Upfront credit disclosure (decision 0020): the spend controls show their
  // price and disable with a reason; enforced=false hides cost vocabulary.
  const refreshBilling = profile?.id
    ? await hasEnoughCredits(profile.id, "job_analysis_refresh")
    : { ok: true, cost: 0, balance: 0, enforced: false };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* Decision-first overview (US-048): one verdict, why, and what next. The
          tab shell + back affordance live in the route layout (US-051); the AI
          workflow panel now lives behind the Advanced tab. */}
      {pkg && pkg.decision ? (
        <>
          <DecisionHeader
            pkg={pkg}
            matchId={match.id}
            coreChainRunning={coreChainRunning}
            refreshBilling={refreshBilling}
          />
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
          action={<RegenerateMatchForm matchId={match.id} label="Run analysis" />}
        />
      ) : (
        <EmptyState
          variant="error"
          title="We couldn't load the latest assessment"
          // packageResult.message is API-authored; the main surface never
          // shows technical detail (US-048) — Advanced keeps the raw story.
          description="The assessment couldn't be loaded this time. Run the analysis again — your saved job and resume are unaffected."
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
            <NextActionsPanel
              pkg={pkg}
              matchId={match.id}
              billingEnforced={refreshBilling.enforced}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
