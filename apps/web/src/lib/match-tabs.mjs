// Pure view helpers for the job-analysis tab shell (US-051).
// Plain ESM so the server components and the node --test suite share one source.
//
// The six tabs render in a FIXED, label-independent order over the existing
// match sub-routes. Emphasis is a visual indicator only — it never reorders and
// never hides tabs, so a tab sits in the same place for every job and every
// decision label (decision 0015 §11 / restatement #17).

// Fixed tab order. `segment` is the sub-route under /matches/{id}; null is the
// Overview (the US-048 surface at the base route). "Advanced" is the display
// name for the Analysis Details surface (restatement #17 — "Analysis Details"
// invites mainstream users into a debug view).
export const MATCH_TABS = [
  { key: "overview", label: "Overview", segment: null },
  { key: "gaps", label: "Skill Gaps", segment: "gaps" },
  { key: "resume", label: "Resume Strategy", segment: "resume-suggestions" },
  { key: "materials", label: "Application Materials", segment: "draft-cv" },
  { key: "interview", label: "Interview Prep", segment: "interview-prep" },
  { key: "advanced", label: "Advanced", segment: "advanced" },
];

// Sub-routes that belong to a tab but aren't its primary segment. Opening any
// of these still lights up the owning tab (spatial consistency). The roadmap
// route maps to NO tab on purpose — it's a sub-page reached from Skill Gaps /
// Learning Target actions, not a seventh tab (US-051 AC). Its orientation comes
// from the breadcrumb (it reads "… › 4-week roadmap"), not a hijacked tab.
// "resume-draft" is gone on purpose: the route was retired by US-059 (decision
// 0019) and old links redirect to draft-cv in next.config.ts.
const SEGMENT_TO_TAB = {
  gaps: "gaps",
  "resume-suggestions": "resume",
  "draft-cv": "materials",
  "cover-letter": "materials",
  "interview-prep": "interview",
  advanced: "advanced",
};

export function matchTabHref(matchId, tab) {
  return tab.segment ? `/matches/${matchId}/${tab.segment}` : `/matches/${matchId}`;
}

// Which tab owns the given pathname. Returns the tab key, or null when the
// route has no tab (e.g. /roadmap) or isn't this match's detail route.
export function tabForPathname(pathname, matchId) {
  if (typeof pathname !== "string" || !matchId) return null;
  const base = `/matches/${matchId}`;
  if (pathname === base || pathname === `${base}/`) return "overview";
  if (!pathname.startsWith(`${base}/`)) return null;
  const segment = pathname.slice(base.length + 1).split("/")[0];
  return SEGMENT_TO_TAB[segment] ?? null;
}

// No-tab sub-pages (reached from a tab or a learning-target action, not the
// six-tab shell). They earn a trailing breadcrumb crumb so the page is *named*
// in the breadcrumb ("… › 4-week roadmap") instead of hijacking a tab.
const SUBPAGE_LABELS = {
  roadmap: "4-week roadmap",
};

// The breadcrumb label for a no-tab sub-page, or null for tabbed routes /
// non-match routes (those are oriented by the active tab, not the breadcrumb).
export function subPageLabelForPathname(pathname, matchId) {
  if (typeof pathname !== "string" || !matchId) return null;
  const base = `/matches/${matchId}`;
  if (!pathname.startsWith(`${base}/`)) return null;
  const segment = pathname.slice(base.length + 1).split("/")[0];
  return SUBPAGE_LABELS[segment] ?? null;
}

// Tab emphasis per decision label (US-051 AC). A visual hint only: the same six
// tabs render in the same order for every label — emphasis points the user at
// the tab most useful for their verdict.
export const LABEL_EMPHASIS = {
  strong_apply: ["materials", "interview"],
  apply_with_improvements: ["resume", "gaps"],
  learning_target: ["gaps"],
  // Gaps, not Overview: the user reading a "not recommended" verdict is already
  // on Overview — the useful pointer is the evidence for why, which also leads
  // to the roadmap.
  not_recommended: ["gaps"],
};

export function emphasisForLabel(label) {
  return LABEL_EMPHASIS[label] ?? [];
}

export function isTabEmphasized(label, tabKey) {
  return emphasisForLabel(label).includes(tabKey);
}
