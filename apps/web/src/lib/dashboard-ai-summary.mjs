/*
  View helpers for the US-036 dashboard AI summary card.

  NOT_ENOUGH_DATA_MESSAGE is the §9.6 data-gate copy and must render verbatim
  when fewer than 3 jobs have been analyzed.
*/

export const NOT_ENOUGH_DATA_MESSAGE =
  "ApplyWise needs more analyzed jobs before giving a strong pattern-based " +
  "recommendation. Add or import at least 3 jobs to unlock a stronger " +
  "dashboard summary.";

const HEALTH_LABELS = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  not_enough_data: "Not enough data",
};

// Badge variants from the shared design system (success/warning/destructive).
const HEALTH_VARIANTS = {
  strong: "success",
  moderate: "warning",
  weak: "destructive",
  not_enough_data: "secondary",
};

function asStrings(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

export function healthLabel(health) {
  return HEALTH_LABELS[health] ?? String(health || "Unknown");
}

export function healthVariant(health) {
  return HEALTH_VARIANTS[health] ?? "outline";
}

export function normalizeDashboardAiSummary(row) {
  const data = row && typeof row === "object" ? row : {};
  const health =
    typeof data.job_search_health === "string" && data.job_search_health in HEALTH_LABELS
      ? data.job_search_health
      : "not_enough_data";
  const confidence = Number(data.confidence_score);

  return {
    dashboard_summary:
      typeof data.dashboard_summary === "string" ? data.dashboard_summary.trim() : "",
    best_fit_roles: asStrings(data.best_fit_roles_json ?? data.best_fit_roles),
    repeated_skill_gaps: asStrings(
      data.repeated_skill_gaps_json ?? data.repeated_skill_gaps
    ),
    job_search_health: health,
    recommended_next_actions: asStrings(
      data.recommended_next_actions_json ?? data.recommended_next_actions
    ),
    confidence_score: Number.isFinite(confidence) ? confidence : null,
    provider: typeof data.provider === "string" ? data.provider : null,
  };
}
