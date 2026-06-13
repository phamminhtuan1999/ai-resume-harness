// Pure view helpers for the decision-first job-analysis overview (US-048).
// Plain ESM so both the server components (.tsx) and the node --test suite can
// import it. No rendering, no I/O. The label set and copy rules trace to
// docs/decisions/0015-job-analysis-decision-engine.md (§1 labels, §11 header).

// label -> display copy + Badge variant. One source of truth; components and
// the matches list (US-053) both read this.
export const DECISION_META = {
  strong_apply: { display: "Strong Apply Target", variant: "success" },
  // Amber: apply, but something needs attention first (DESIGN.md verdict canon).
  apply_with_improvements: { display: "Apply With Improvements", variant: "warning" },
  // Blue: aspirational, not hazardous — a goal to build toward, never a caution.
  learning_target: { display: "Learning Target", variant: "info" },
  // Muted, not alarming: the verdict recommends, it never closes the door.
  not_recommended: { display: "Not Recommended Yet", variant: "secondary" },
};

export const RISK_META = {
  low: { label: "Low risk", variant: "success" },
  medium: { label: "Medium risk", variant: "warning" },
  high: { label: "High risk", variant: "destructive" },
};

// Better-to-worse ordering, used to phrase the change delta.
const LABEL_RANK = {
  not_recommended: 0,
  learning_target: 1,
  apply_with_improvements: 2,
  strong_apply: 3,
};

const LIVE_APPLICATION_STATUSES = new Set(["applied", "interviewing", "offer"]);

export function decisionMeta(label) {
  return DECISION_META[label] ?? null;
}

export function decisionDisplay(label) {
  return DECISION_META[label]?.display ?? "";
}

export function riskMeta(level) {
  return RISK_META[level] ?? null;
}

// "Weak match · High risk" — fully qualitative (owner decision 2026-06-12,
// superseding the US-048 single-percentage header): no raw number leads the
// screen; the exact score lives in the Score breakdown with its context.
const MATCH_BANDS = [
  [75, "Strong match"],
  [60, "Good match"],
  [40, "Partial match"],
  [0, "Weak match"],
];

export function formatVerdictLine(matchScore, riskLevel) {
  const parts = [];
  if (typeof matchScore === "number" && Number.isFinite(matchScore)) {
    const band = MATCH_BANDS.find(([min]) => matchScore >= min);
    parts.push(band ? band[1] : "Weak match");
  }
  const risk = RISK_META[riskLevel];
  if (risk) {
    parts.push(risk.label);
  }
  return parts.join(" · ");
}

// The header change delta. Returns null when there's no prior decision or the
// label is unchanged. direction is "Up" | "Down" | "Changed".
export function decisionDelta(previousLabel, currentLabel) {
  if (!previousLabel || previousLabel === currentLabel) {
    return null;
  }
  const prevRank = LABEL_RANK[previousLabel];
  const curRank = LABEL_RANK[currentLabel];
  let direction = "Changed";
  if (typeof prevRank === "number" && typeof curRank === "number") {
    direction = curRank > prevRank ? "Up" : curRank < prevRank ? "Down" : "Changed";
  }
  return { direction, fromDisplay: decisionDisplay(previousLabel) || previousLabel };
}

export function isLiveApplication(status) {
  return LIVE_APPLICATION_STATUSES.has(status ?? "");
}

// The applied-banner kind for a tracker row, or null when the job isn't a live
// application. The component formats the date.
export function liveApplicationKind(status) {
  return isLiveApplication(status) ? status : null;
}

// Which profile affordances the confidence reasons call for (decision 0015 §3).
// US-053 adds the explicit completeness warning, surfaced on the overview when
// the engine flags an incomplete profile.
export function profilePromptFromReasons(reasons) {
  const set = new Set(Array.isArray(reasons) ? reasons : []);
  return {
    showProfileLink: set.has("profile_incomplete") || set.has("no_target_role"),
    showTargetRolePrompt: set.has("no_target_role"),
    showCompletenessWarning: set.has("profile_incomplete"),
  };
}

// no_evidence -> "Missing", weak_evidence -> "Needs confirmation" (US-029).
export function evidenceStatusLabel(status) {
  if (status === "weak_evidence") return "Needs confirmation";
  if (status === "strong_evidence") return "Shown";
  return "Missing";
}

// not_recommended must always name the concrete path forward, never just the
// verdict (US-048 AC). Returns null for other labels.
export function pathForward(label, missingSkills) {
  if (label !== "not_recommended") {
    return null;
  }
  const named = (Array.isArray(missingSkills) ? missingSkills : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (named.length === 0) {
    return "To make this realistic, start by completing your profile so the analysis has more to work with.";
  }
  const skills = named.length === 2 ? `${named[0]} and ${named[1]}` : named[0];
  return `To make this realistic, you'd need evidence of ${skills} — start with your profile.`;
}

// US-051: the persistent roadmap entry card on Overview. The learning-target
// persona's primary artifact needs a stable home without a seventh tab, so when
// a roadmap has been generated for the match the Overview shows an entry card.
// Returns the newest completed roadmap run's timestamp, or null when none exists.
export function roadmapEntryFromRuns(runs) {
  const completed = (Array.isArray(runs) ? runs : []).filter(
    (r) => r && r.workflow_type === "roadmap" && r.status === "completed"
  );
  if (completed.length === 0) return null;
  let latest = completed[0];
  for (const r of completed) {
    if ((r.completed_at ?? "") > (latest.completed_at ?? "")) latest = r;
  }
  return { generatedAt: latest.completed_at ?? null };
}

// Frontend-authored copy must stay free of model/debug vocabulary on the main
// surface (US-048 AC). Exported so the test can lint the helpers' output.
export const DEBUG_TERMS = [
  "deterministic",
  "gemini",
  "workflow",
  "endpoint",
  "json",
  "supabase",
  "module",
];
