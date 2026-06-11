// Centralized error/health-state mapping for the job-analysis surface (US-053).
// One place maps a cause -> friendly copy -> recovery action; no technical codes
// or module names on the main surface (those live in Advanced Analysis Details).
// Plain ESM so the server components and the node --test suite share one source.

// Confidence reason codes that mean the job description was missing or too thin.
const JOB_DESCRIPTION_REASONS = ["job_not_extracted", "job_description_short"];

// A health notice shown alongside a rendered decision when the inputs were
// degraded but a verdict still computed. Returns null when the analysis is
// healthy. recovery.kind tells the component which control to render:
//   "edit_job" -> link to the job edit/import surface (href provided)
//   "refresh"  -> point at the header Refresh Analysis control (no href)
export function analysisHealthNotice(reasons, { jobId } = {}) {
  const set = new Set(Array.isArray(reasons) ? reasons : []);

  // AI / model issue first: a failed module is the more serious cause.
  if (set.has("module_failed")) {
    return {
      tone: "warning",
      title: "Part of this analysis didn't finish",
      message:
        "Some of the assessment couldn't be completed this time. Refresh the analysis to try again.",
      recovery: { kind: "refresh" },
    };
  }

  // Missing / empty job description: send the user to re-import or paste it.
  if (JOB_DESCRIPTION_REASONS.some((reason) => set.has(reason))) {
    return {
      tone: "warning",
      title: "We couldn't read enough of this job",
      message:
        "Add or re-import the full job description so the analysis has more to work with.",
      recovery: jobId ? { kind: "edit_job", href: `/jobs/${jobId}` } : { kind: "refresh" },
    };
  }

  return null;
}
