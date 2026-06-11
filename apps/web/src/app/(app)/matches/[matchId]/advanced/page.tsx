import { AiWorkflowPanel } from "@/components/ai-workflow-panel";
import { AnalysisHistory } from "@/components/matches/analysis-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalysisHistory, getAnalysisPackage, getMatchAiWorkflowRuns } from "@/lib/data/server";

type AdvancedPageProps = {
  params: Promise<{ matchId: string }>;
};

// "Advanced" Analysis Details (US-051): the technical workflow surface, moved
// off the main Overview. The numeric confidence % lives here, not in the header
// (restatement #16). US-054 mounts the decision history below the panel.
export default async function MatchAdvancedPage({ params }: AdvancedPageProps) {
  const { matchId } = await params;
  const [packageResult, aiWorkflow, historyResult] = await Promise.all([
    getAnalysisPackage(matchId),
    getMatchAiWorkflowRuns(matchId),
    getAnalysisHistory(matchId),
  ]);
  const history = historyResult.ok ? historyResult.history : null;

  const decision = packageResult.ok ? packageResult.package.decision : null;
  const confidence = decision?.confidence ?? null;
  const confidencePct =
    confidence && confidence.score !== null ? Math.round(confidence.score * 100) : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Advanced analysis details</h1>
        <p className="text-sm text-muted-foreground">
          The technical workflow behind your analysis — step status, models, confidence, and
          history. You don&apos;t need this to act on the recommendation.
        </p>
      </div>

      {confidence ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis confidence</CardTitle>
            <CardDescription>{confidence.qualitative}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {confidencePct !== null ? `${confidencePct}%` : "Not yet scored"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <AiWorkflowPanel
        matchId={matchId}
        runs={aiWorkflow.runs}
        profileReady={aiWorkflow.profileReady}
        jobImported={aiWorkflow.jobImported}
        jobParsed={aiWorkflow.jobParsed}
      />

      <AnalysisHistory history={history} />
    </div>
  );
}
