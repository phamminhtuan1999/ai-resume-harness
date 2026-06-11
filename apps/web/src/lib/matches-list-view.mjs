// Naming + list-row helpers for the job-analysis surface (US-053). Route paths
// stay /matches; only the user-facing copy changes. Plain ESM so the server
// components and the node --test suite share one source.

import { decisionMeta } from "./analysis-package-view.mjs";

// The matches LIST is "Analyzed Jobs"; a single analysis is "Job Analysis"
// (restatement #8 — copy-only rename, plainer than the awkward "Job Analyses").
export const ANALYZED_JOBS_LABEL = "Analyzed Jobs";
export const JOB_ANALYSIS_LABEL = "Job Analysis";

// Breadcrumb for the analysis detail surface: Analyzed Jobs → Job Analysis. The
// first crumb is the back-to-jobs link (decision: the matches-list equivalent,
// stable regardless of whether the user arrived from /jobs or /matches).
export function jobAnalysisBreadcrumb() {
  return [
    { label: ANALYZED_JOBS_LABEL, href: "/matches" },
    { label: JOB_ANALYSIS_LABEL },
  ];
}

// The list-row verdict badge. When a decision snapshot exists it uses the SAME
// vocabulary as the detail page (decision 0015 §10 — list and detail never speak
// two vocabularies). Returns null for never-recomputed matches so the caller
// falls back to the legacy score-derived badge.
export function matchListVerdict(decisionLabel) {
  return decisionMeta(decisionLabel);
}

// The match % a list row shows: the decision snapshot's score when present,
// else the match's stored overall score.
export function matchListScore(decisionScore, overallScore) {
  if (typeof decisionScore === "number") return Math.round(decisionScore);
  if (typeof overallScore === "number") return Math.round(overallScore);
  return null;
}
