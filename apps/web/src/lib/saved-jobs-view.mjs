/*
  Pure, server-safe view-model helpers for the saved-jobs table (/jobs).
  Sorting runs in the server component over the already-loaded rows, so the page
  stays a server component and the sort control can be plain links (?sort=).
*/

/** Sort keys understood by sortSavedJobs / the toolbar links. */
export const SAVED_JOB_SORTS = ["recent", "match", "company"];

/** Human label for each sort key (toolbar control). */
export function savedJobSortLabel(sortKey) {
  switch (resolveSavedJobSort(sortKey)) {
    case "match":
      return "Best match";
    case "company":
      return "Company";
    default:
      return "Recently saved";
  }
}

/** Normalize an arbitrary ?sort= value to a known key (defaults to "recent"). */
export function resolveSavedJobSort(value) {
  return SAVED_JOB_SORTS.includes(value) ? value : "recent";
}

/**
 * Return a sorted copy of the saved-jobs rows. Never mutates the input.
 *   - recent (default): newest created_at first (ISO strings compare lexically)
 *   - match: highest best-match score first; rows with no analyzed match sink
 *     to the bottom (treated as -1)
 *   - company: A→Z by company, then role title
 * Every branch falls back to company-then-title so the order is deterministic
 * across renders (no jitter on equal keys).
 *
 * matchScoreById maps a job id to its best analyzed Match score (or omits it).
 */
export function sortSavedJobs(jobs, sortKey, matchScoreById = {}) {
  const list = Array.isArray(jobs) ? [...jobs] : [];
  const key = resolveSavedJobSort(sortKey);

  const scoreOf = (job) => {
    const value = matchScoreById?.[job?.id];
    return typeof value === "number" && Number.isFinite(value) ? value : -1;
  };
  const byCompanyThenTitle = (a, b) =>
    String(a?.company ?? "").localeCompare(String(b?.company ?? "")) ||
    String(a?.title ?? "").localeCompare(String(b?.title ?? ""));

  if (key === "company") {
    return list.sort(byCompanyThenTitle);
  }
  if (key === "match") {
    return list.sort((a, b) => scoreOf(b) - scoreOf(a) || byCompanyThenTitle(a, b));
  }
  return list.sort(
    (a, b) =>
      String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")) ||
      byCompanyThenTitle(a, b)
  );
}
