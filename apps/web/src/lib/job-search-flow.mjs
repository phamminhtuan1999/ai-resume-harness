/*
  Calls the backend job-search enrichment endpoint (POST /api/jobs/search-ai) and
  normalizes the result into the action `{ ok, ... }` shape. Mirrors
  job-import-flow: a `fetchImpl` seam keeps it unit-testable without network.

  Also exports pure view-model helpers used by the search panel component:
  groupJobResults, aiRelevanceBadge, quickMatchBadge, recommendedActionLabel.
*/

// Score thresholds mirror decision 0025 (also in ai-relevance.mjs).
const RELEVANCE_THRESHOLD_STRONG = 75;
const RELEVANCE_THRESHOLD_POSSIBLE = 60;

function _aiRelevanceLabelFromScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "hidden";
  if (score >= RELEVANCE_THRESHOLD_STRONG) return "strong";
  if (score >= RELEVANCE_THRESHOLD_POSSIBLE) return "possible";
  return "hidden";
}

// --- API fetch wrapper ---

export async function searchAiJobs({
  apiBaseUrl,
  fetchImpl = fetch,
  request,
  sessionToken,
}) {
  if (!apiBaseUrl) {
    return {
      ok: false,
      message: "Job search API is not configured.",
      error: { code: "not_configured" },
    };
  }
  if (!sessionToken) {
    return {
      ok: false,
      message: "Unable to authenticate job search.",
      error: null,
    };
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/jobs/search-ai`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    return {
      ok: false,
      message: "Job search API could not be reached.",
      error: { code: "search_unavailable" },
    };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : "Job search failed.";
    return { ok: false, message: detail, error: null };
  }

  if (!payload || typeof payload.search_session_id !== "string") {
    return { ok: false, message: "Job search returned invalid data.", error: null };
  }

  // 200 with error envelope (search_not_configured / search_unavailable)
  if (payload.error?.code) {
    return {
      ok: false,
      message: payload.error.message || "Job search unavailable.",
      error: payload.error,
      result: payload,
    };
  }

  return { ok: true, result: payload };
}

// --- Pure view-model helpers ---

/**
 * Split jobs into visible (not hidden) and hidden groups.
 */
export function groupJobResults(jobs) {
  const visible = [];
  const hidden = [];
  for (const job of jobs) {
    if (job.hidden) {
      hidden.push(job);
    } else {
      visible.push(job);
    }
  }
  return { visible, hidden };
}

/**
 * Badge variant + label for the AI relevance score.
 * Mirrors decision 0025 thresholds (strong ≥75, possible ≥60, hidden <60).
 */
export function aiRelevanceBadge(aiRelevance) {
  if (!aiRelevance) return { variant: "outline", label: "Unknown" };
  const label = _aiRelevanceLabelFromScore(aiRelevance.ai_relevance_score);
  if (label === "strong") return { variant: "success", label: "Strong AI match" };
  if (label === "possible") return { variant: "info", label: "AI-adjacent" };
  return { variant: "outline", label: "Below threshold" };
}

/**
 * Badge variant + label for the candidate quick match score.
 */
export function quickMatchBadge(quickMatch) {
  if (!quickMatch || quickMatch.unavailable) {
    return { variant: "outline", label: "Preview unavailable" };
  }
  const matchLabel = quickMatch.match_label;
  if (matchLabel === "strong") return { variant: "success", label: `Strong fit · ${quickMatch.preview_match_score}%` };
  if (matchLabel === "possible") return { variant: "info", label: `Possible fit · ${quickMatch.preview_match_score}%` };
  if (matchLabel === "weak") return { variant: "warning", label: `Weak fit · ${quickMatch.preview_match_score}%` };
  return { variant: "outline", label: "Limited data" };
}

/**
 * Human-readable label for the enricher's recommended_action value.
 */
export function recommendedActionLabel(action) {
  switch (action) {
    case "save_and_analyze": return "Save & Analyze";
    case "save": return "Save";
    case "review_carefully": return "Review carefully";
    case "skip": return "Skip";
    default: return "Review";
  }
}

/**
 * Badge variant for transition friendliness.
 */
export function transitionFriendlinessBadge(value) {
  if (value === "high") return { variant: "success", label: "Transition-friendly" };
  if (value === "medium") return { variant: "info", label: "Some transition" };
  return { variant: "outline", label: "Harder transition" };
}
