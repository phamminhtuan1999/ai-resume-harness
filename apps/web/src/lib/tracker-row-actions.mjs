// Row-level action shortcuts for the tracker (US-081). Pure presenter so the
// server component and the node --test suite share one source.
//
// Each shortcut routes to an existing match sub-route. Those sub-pages ARE the
// generation surface when their artifact doesn't exist yet (the draft-cv /
// cover-letter / interview-prep / roadmap pages render a generate form when the
// row is missing), so a shortcut is always a valid destination and the existing
// per-page readiness rules stay the single source of truth. When the loader can
// supply artifact existence we annotate `state` ("ready" | "generate") for a
// subtle hint; absent that, shortcuts default to "open".
//
// Segments mirror match-tabs.mjs so the tracker and the analysis tab shell never
// drift. Roadmap intentionally has no tab there — it's a sub-page reached from
// Skill Gaps / Learning Target actions — but it IS a first-class tracker
// shortcut, especially for Learning Targets (US-052 / decision 0015 §8).

import { isLearningTarget } from "./application-tracker.mjs";

// Application-material shortcuts, in display order. `key` matches the artifact
// readiness keys a loader would supply; `segment` is the match sub-route.
export const TRACKER_MATERIAL_SHORTCUTS = [
  { key: "draft_cv", label: "Tailored CV", segment: "draft-cv" },
  { key: "cover_letter", label: "Cover letter", segment: "cover-letter" },
  { key: "interview_prep", label: "Interview prep", segment: "interview-prep" },
  { key: "roadmap", label: "4-week roadmap", segment: "roadmap" },
];

// A Learning Target is not an active application: surfacing CV / cover-letter /
// interview-prep shortcuts on it would imply the user is applying. Only the
// roadmap is relevant there, and it stays prominent (AC6).
const LEARNING_TARGET_MATERIAL_KEYS = ["roadmap"];

// Contact notes are labeled distinctly from application notes so the row never
// conflates "who to talk to" with "my notes about this application" (AC1).
export const CONTACT_NOTE_LABEL = "Contact note";

/**
 * The trimmed contact note for a job, or null when there is none.
 * @param {{ contact_notes?: string | null } | null | undefined} job
 * @returns {string | null}
 */
export function getContactNote(job) {
  const note = job?.contact_notes;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {string} segment
 * @param {Record<string, boolean> | undefined} artifacts
 * @param {string} key
 * @returns {"ready" | "generate" | "open"}
 */
function shortcutState(segment, artifacts, key) {
  if (!artifacts) return "open";
  return artifacts[key] ? "ready" : "generate";
}

/**
 * Build the ordered row actions for a tracker application row.
 *
 * @param {{ job_id?: string | null, match_id?: string | null, status?: string | null }} application
 * @param {{ artifacts?: Record<string, boolean> }} [options] - optional artifact
 *   existence map keyed by shortcut key (e.g. { draft_cv: true }); omit to route
 *   straight to each surface without a ready/generate hint.
 */
export function buildTrackerRowActions(application, options = {}) {
  const { artifacts } = options;
  const jobId = application?.job_id ?? null;
  const matchId = application?.match_id ?? null;
  const learningTarget = isLearningTarget(application?.status);

  const job = jobId ? { key: "job", label: "Job detail", href: `/jobs/${jobId}` } : null;

  // Job Analysis (and every material shortcut) requires a linked match.
  const analysis = matchId
    ? { key: "analysis", label: "Job analysis", href: `/matches/${matchId}` }
    : null;

  const allowedKeys = learningTarget ? LEARNING_TARGET_MATERIAL_KEYS : null;

  const materials = matchId
    ? TRACKER_MATERIAL_SHORTCUTS.filter(
        (shortcut) => !allowedKeys || allowedKeys.includes(shortcut.key)
      ).map((shortcut) => ({
        key: shortcut.key,
        label: shortcut.label,
        href: `/matches/${matchId}/${shortcut.segment}`,
        state: shortcutState(shortcut.segment, artifacts, shortcut.key),
        // Roadmap leads the way for a Learning Target — building toward the role
        // is the point, and it must not read as an active application.
        prominent: learningTarget && shortcut.key === "roadmap",
      }))
    : [];

  return { job, analysis, materials, hasMatch: Boolean(matchId), isLearningTarget: learningTarget };
}
