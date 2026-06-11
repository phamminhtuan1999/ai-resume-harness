import { MatchTabsNav } from "@/components/matches/match-tabs-nav";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getAnalysisPackage } from "@/lib/data/server";
import { jobAnalysisBreadcrumb } from "@/lib/matches-list-view.mjs";

type MatchLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ matchId: string }>;
};

// Shared shell for the job-analysis surface (US-051): a breadcrumb (US-053) plus
// the fixed six-tab navigation across the match sub-routes. The decision label
// drives tab emphasis; it's read once here and deduped with the page's own fetch
// via the React-cached data accessor. The breadcrumb's first crumb doubles as the
// back-to-jobs link.
export default async function MatchLayout({ children, params }: MatchLayoutProps) {
  const { matchId } = await params;
  const packageResult = await getAnalysisPackage(matchId);
  const label =
    packageResult.ok ? (packageResult.package.decision?.label ?? null) : null;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <Breadcrumb items={jobAnalysisBreadcrumb()} />
        <MatchTabsNav matchId={matchId} label={label} />
      </div>
      {children}
    </div>
  );
}
