"use client";

import { usePathname } from "next/navigation";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { subPageLabelForPathname } from "@/lib/match-tabs.mjs";
import { jobAnalysisBreadcrumb } from "@/lib/matches-list-view.mjs";

// Route-aware breadcrumb for the job-analysis shell. Tabbed routes are oriented
// by the active tab, so the breadcrumb stays "Analyzed Jobs › Job Analysis".
// No-tab sub-pages (the 4-week roadmap) gain a trailing crumb and turn "Job
// Analysis" into a back link — the page is named here instead of claiming a tab.
export function MatchBreadcrumb({ matchId }: { matchId: string }) {
  const pathname = usePathname();
  const subPage = subPageLabelForPathname(pathname, matchId);
  const base = jobAnalysisBreadcrumb();

  const items = subPage
    ? [base[0], { label: base[1].label, href: `/matches/${matchId}` }, { label: subPage }]
    : base;

  return <Breadcrumb items={items} />;
}
