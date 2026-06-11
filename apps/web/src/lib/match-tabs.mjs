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
// route maps to NO tab on purpose — it's reached through Learning Target
// actions and Skill Gaps, not a seventh tab (US-051 AC).
const SEGMENT_TO_TAB = {
  gaps: "gaps",
  "resume-suggestions": "resume",
  "resume-draft": "resume",
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

// Tab emphasis per decision label (US-051 AC). A visual hint only: the same six
// tabs render in the same order for every label — emphasis points the user at
// the tab most useful for their verdict.
export const LABEL_EMPHASIS = {
  strong_apply: ["materials", "interview"],
  apply_with_improvements: ["resume", "gaps"],
  learning_target: ["gaps"],
  not_recommended: ["overview"],
};

export function emphasisForLabel(label) {
  return LABEL_EMPHASIS[label] ?? [];
}

export function isTabEmphasized(label, tabKey) {
  return emphasisForLabel(label).includes(tabKey);
}
