"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  MATCH_TABS,
  isTabEmphasized,
  matchTabHref,
  tabForPathname,
} from "@/lib/match-tabs.mjs";
import type { DecisionLabel } from "@/lib/data/server";
import { cn } from "@/lib/utils";

type MatchTabsNavProps = {
  matchId: string;
  label: DecisionLabel | null;
};

// Tab navigation across the match sub-routes (US-051). Links, not in-page tab
// state, so each tab is a real, shareable route and the active tab is derived
// from the URL. Emphasis is a non-color-only marker (a shape that appears or
// not, plus an assistive-tech label) — never reordering, never hiding.
export function MatchTabsNav({ matchId, label }: MatchTabsNavProps) {
  const pathname = usePathname() ?? "";
  const activeKey = tabForPathname(pathname, matchId);

  return (
    <nav
      aria-label="Job analysis sections"
      className="-mb-px flex gap-1 overflow-x-auto border-b"
    >
      {MATCH_TABS.map((tab) => {
        const isActive = tab.key === activeKey;
        const emphasized = label ? isTabEmphasized(label, tab.key) : false;
        return (
          <Link
            key={tab.key}
            href={matchTabHref(matchId, tab)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {emphasized ? (
              <>
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-brand"
                />
                <span className="sr-only">(suggested for this result)</span>
              </>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
