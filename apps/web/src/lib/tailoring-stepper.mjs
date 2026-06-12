// Tailoring stepper state (US-061, decision 0019). Pure ESM so the shared
// header component and the node --test suite use one source.
//
// The two-tier flow is one visible journey across two tabs:
//   1 Suggest → 2 Respond → 3 Generate → 4 Final check → 5 Export
// Steps 1–2 live on the suggestions page (Resume Strategy tab); steps 3–5 live
// on the draft-cv page (Application Materials tab). The fixed six-tab shell
// (decision 0015) is unchanged — the stepper links across it.

export const TAILORING_STEPS = [
  { key: "suggest", label: "Suggest", segment: "resume-suggestions" },
  { key: "respond", label: "Respond", segment: "resume-suggestions" },
  { key: "generate", label: "Generate", segment: "draft-cv" },
  { key: "final_check", label: "Final check", segment: "draft-cv" },
  { key: "export", label: "Export", segment: "draft-cv" },
];

/* The current step key, derived from artifact presence — never stored.
   A draft's existence outranks suggestion counts: once a CV exists the user
   is past generation, even if they skipped or later re-opened suggestions.
   A clean review (ready_to_export) moves the highlight onto Export; an
   exported draft keeps "export" as the active step (rendered done). */
export function currentStep({ suggestionCount, respondedCount, hasDraft, draftStatus }) {
  if (hasDraft) {
    if (draftStatus === "exported" || draftStatus === "ready_to_export") {
      return "export";
    }
    return "final_check";
  }
  if (!suggestionCount) {
    return "suggest";
  }
  if ((respondedCount ?? 0) < suggestionCount) {
    return "respond";
  }
  return "generate";
}

export function stepIndex(key) {
  return TAILORING_STEPS.findIndex((step) => step.key === key);
}

export function stepHref(matchId, step) {
  return `/matches/${matchId}/${step.segment}`;
}

/* Per-step render state for the header: "done" | "current" | "todo".
   An exported draft completes the journey — Export itself flips to "done"
   (all five steps green) instead of staying highlighted forever. */
export function stepStates(state) {
  const activeIndex = stepIndex(currentStep(state));
  const journeyComplete = state?.draftStatus === "exported";
  return TAILORING_STEPS.map((step, index) => ({
    ...step,
    state:
      index < activeIndex || (journeyComplete && index === activeIndex)
        ? "done"
        : index === activeIndex
          ? "current"
          : "todo",
  }));
}
