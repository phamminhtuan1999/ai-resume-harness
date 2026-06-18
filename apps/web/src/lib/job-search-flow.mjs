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

// --- Pagination ("Load more") ---

/**
 * Merge a freshly-fetched page onto the accumulated results for "Load more".
 * Jobs are de-duplicated by external_job_id (provider pages can overlap),
 * total_provider_results accumulates across fetched pages, total_ai_related is
 * recomputed over the merged set, and the page/has_more flags come from the new
 * page so the UI knows whether to keep offering "Load more".
 */
export function appendSearchPage(previous, next) {
  const prevJobs = Array.isArray(previous?.jobs) ? previous.jobs : [];
  const nextJobs = Array.isArray(next?.jobs) ? next.jobs : [];

  const seen = new Set(prevJobs.map((job) => job.external_job_id));
  const jobs = [...prevJobs];
  for (const job of nextJobs) {
    if (seen.has(job.external_job_id)) continue;
    seen.add(job.external_job_id);
    jobs.push(job);
  }

  return {
    ...next,
    jobs,
    total_provider_results:
      (previous?.total_provider_results ?? 0) + (next?.total_provider_results ?? 0),
    total_ai_related_results: jobs.filter((job) => !job.hidden).length,
    page: next?.page,
    has_more: Boolean(next?.has_more),
  };
}

// --- Results list: sort, filter, and company identity (search redesign) ---

/** Sort keys understood by sortSearchJobs (the results toolbar control). */
export const SEARCH_SORT_KEYS = ["recommended", "relevance", "fit", "newest"];

function _searchSortScore(job, sortKey) {
  if (sortKey === "relevance") {
    const score = job?.ai_relevance?.ai_relevance_score;
    return typeof score === "number" && Number.isFinite(score) ? score : -1;
  }
  // "fit": rank by the candidate quick-match; unavailable/missing sinks to the end.
  const quickMatch = job?.quick_match;
  if (!quickMatch || quickMatch.unavailable) return -1;
  const score = quickMatch.preview_match_score;
  return typeof score === "number" && Number.isFinite(score) ? score : -1;
}

/**
 * Return a sorted copy of the job list. "recommended" (and any unknown key)
 * preserves the order the server already ranked. "relevance" and "fit" sort by
 * the respective score descending; "newest" sorts by posted date descending.
 * Ties keep their original order (stable); missing scores/dates sink to the
 * bottom.
 */
export function sortSearchJobs(jobs, sortKey = "recommended") {
  const list = Array.isArray(jobs) ? [...jobs] : [];
  if (sortKey === "newest") {
    return list
      .map((job, index) => ({
        job,
        index,
        posted: typeof job?.posted_at === "string" ? job.posted_at : "",
      }))
      .sort((a, b) => b.posted.localeCompare(a.posted) || a.index - b.index)
      .map((entry) => entry.job);
  }
  if (sortKey !== "relevance" && sortKey !== "fit") return list;
  return list
    .map((job, index) => ({ job, index, score: _searchSortScore(job, sortKey) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.job);
}

/**
 * Filter the job list by the active result chips. Flags are AND-combined; an
 * all-false set returns the list unchanged. Every flag reads a field already on
 * the job, so filtering never triggers another fetch.
 *   - strongAi: AI relevance score >= 75 (decision 0025 "strong" threshold)
 *   - transitionFriendly: transition_friendliness === "high"
 *   - strongFit: quick match is available and labelled "strong"
 */
export function filterSearchJobs(jobs, filters = {}) {
  const list = Array.isArray(jobs) ? jobs : [];
  return list.filter((job) => {
    if (
      filters.strongAi &&
      !((job?.ai_relevance?.ai_relevance_score ?? -1) >= RELEVANCE_THRESHOLD_STRONG)
    ) {
      return false;
    }
    if (filters.transitionFriendly && job?.ai_relevance?.transition_friendliness !== "high") {
      return false;
    }
    if (filters.strongFit) {
      const quickMatch = job?.quick_match;
      if (!quickMatch || quickMatch.unavailable || quickMatch.match_label !== "strong") {
        return false;
      }
    }
    return true;
  });
}

/**
 * Monogram for the company tile on a result card. Falls back to the job title
 * when the company is blank, and to "?" when neither yields a letter or digit.
 * Multi-word names use the first letter of the first two words.
 */
export function companyInitials(company, fallback = "") {
  const source =
    (typeof company === "string" && company.trim()) ||
    (typeof fallback === "string" && fallback.trim()) ||
    "";
  const words = source
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const _MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Short label for an ISO posted date ("2025-01-15T09:00:00Z" → "Jan 15, 2025").
 * Parsed straight off the YYYY-MM-DD prefix so it's timezone-independent and
 * deterministic; returns null for anything that isn't a valid date string.
 */
export function postedDateLabel(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${_MONTHS[monthIndex]} ${Number(day)}, ${year}`;
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
