// Pure view helpers for Refresh Analysis (US-050). Plain ESM so the client
// control and the node --test suite share one source.

import { decisionDisplay } from "./analysis-package-view.mjs";

// The decision core chain (must match the backend CORE_STEP_TYPES). A refresh is
// "running" while any of these is queued/running.
export const CORE_WORKFLOW_TYPES = ["match_analysis", "missing_skills", "assistant_insight"];

const IN_PROGRESS = new Set(["queued", "running"]);

// True when a core-chain run is queued/running for the match — drives the
// progress banner, the disabled control, and AutoRefresh polling.
export function isCoreChainRunning(runs) {
  const list = Array.isArray(runs) ? runs : [];
  return list.some(
    (run) =>
      CORE_WORKFLOW_TYPES.includes(run?.workflow_type) && IN_PROGRESS.has(run?.status)
  );
}

// The post-refresh result banner. Changed → announces the transition; unchanged
// → confirms the recommendation held. Returns { kind, message }.
export function refreshResultBanner(beforeLabel, afterLabel) {
  if (beforeLabel && afterLabel && beforeLabel !== afterLabel) {
    return {
      kind: "changed",
      message: `Your fit changed: ${decisionDisplay(beforeLabel)} → ${decisionDisplay(afterLabel)}`,
    };
  }
  return { kind: "unchanged", message: "Analysis updated — same recommendation." };
}
