// Tracker next-step routing (US-084). Pure derivation over the rows that
// getTrackerData already loads (owned-scoped there), turning the Notion
// template's generic "resources" section into ApplyWise-native routing.
//
// Contract rules baked in here:
// - Every emitted route points at an IMPLEMENTED app route. Capability-gated
//   features (Search AI Jobs is a planned Period 16 intake with no route yet)
//   are only offered when the caller passes a concrete href, so the panel never
//   renders a broken primary action.
// - Routes are product-native: analyze tracked jobs that have no match, continue
//   Learning Target roadmaps, (later) search AI jobs. No generic third-party
//   job-board / course clutter, and nothing here implies a provider integration.
// - When nothing is actionable, the panel shows a minimal empty state, not a
//   filler link list.

import {
  isActiveApplicationStatus,
  isLearningTarget,
} from "./application-tracker.mjs";

/**
 * @typedef {Object} NextStep
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {string} href
 * @property {number | null} count
 */

/**
 * Derive product-native next-step routes for the tracker.
 *
 * @param {ReadonlyArray<any>} applications tracker rows from getTrackerData
 * @param {{ searchJobsHref?: string | null }} [options] pass a concrete href
 *   only when the Search AI Jobs intake route actually exists; omit/null keeps
 *   that action hidden so it can never render broken.
 * @returns {{ steps: NextStep[], isEmpty: boolean }}
 */
export function buildTrackerNextSteps(applications, options = {}) {
  const list = Array.isArray(applications) ? applications : [];
  const searchJobsHref =
    typeof options.searchJobsHref === "string" && options.searchJobsHref.trim()
      ? options.searchJobsHref.trim()
      : null;

  let needsAnalysis = 0;
  /** @type {string[]} */
  const learningRoadmapMatchIds = [];
  for (const application of list) {
    const status = application?.status;
    const matchId = application?.match_id ?? null;
    if (isLearningTarget(status)) {
      // A Learning Target's next step is its roadmap, reachable once it has a
      // match. It is never counted as a job-needing-analysis (never active).
      if (matchId) learningRoadmapMatchIds.push(matchId);
    } else if (isActiveApplicationStatus(status) && !matchId) {
      // An active (pipeline) tracked job with no match hasn't been analyzed.
      needsAnalysis += 1;
    }
  }

  /** @type {NextStep[]} */
  const steps = [];

  // 1. Search AI jobs — capability-gated (AC: only when the route exists).
  if (searchJobsHref) {
    steps.push({
      key: "search_ai_jobs",
      label: "Search AI jobs",
      description: "Find new AI roles to analyze.",
      href: searchJobsHref,
      count: null,
    });
  }

  // 2. Analyze tracked jobs that have no match yet (AC: route to analyze).
  if (needsAnalysis > 0) {
    steps.push({
      key: "analyze_jobs",
      label: needsAnalysis === 1 ? "Analyze 1 tracked job" : `Analyze ${needsAnalysis} tracked jobs`,
      description: "Run match analysis on tracked jobs that aren't analyzed yet.",
      href: "/jobs",
      count: needsAnalysis,
    });
  }

  // 3. Continue Learning Target roadmaps (AC: route to continue roadmaps).
  if (learningRoadmapMatchIds.length > 0) {
    const count = learningRoadmapMatchIds.length;
    steps.push({
      key: "continue_roadmaps",
      label: count === 1 ? "Continue your roadmap" : `Continue ${count} roadmaps`,
      description: "Keep building skills toward your Learning Target roles.",
      // A single roadmap jumps straight in; several route to the matches list
      // (no roadmap index exists, and pointing back to /tracker would loop).
      href: count === 1 ? `/matches/${learningRoadmapMatchIds[0]}/roadmap` : "/matches",
      count,
    });
  }

  return { steps, isEmpty: steps.length === 0 };
}
