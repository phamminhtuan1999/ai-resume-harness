// Interview scheduling vocabulary + validation for tracker rows (US-082).
// Plain ESM so the server action, the client form, and the node --test suite
// share one source.
//
// Scheduling metadata (date / stage / notes) is OPTIONAL and additive. It lives
// on the application row, never depends on a match or interview_preps (a row may
// have no match), and never changes tracker status semantics: a Learning Target
// with interview fields is still a Learning Target until the user changes the
// status. Interview date is distinct from applied_date — applying and
// interviewing are different lifecycle events.
//
// Stage is constrained to a known set in the app layer; the DB column stays free
// text (like notes) so the vocabulary can evolve without a migration.

export const INTERVIEW_STAGES = [
  "recruiter_screen",
  "hiring_manager",
  "technical",
  "system_design",
  "onsite",
  "final",
  "other",
];

export const INTERVIEW_STAGE_LABELS = {
  recruiter_screen: "Recruiter screen",
  hiring_manager: "Hiring manager",
  technical: "Technical",
  system_design: "System design",
  onsite: "Onsite",
  final: "Final round",
  other: "Other",
};

// Keep interview notes a short scheduling reminder, not a document.
export const INTERVIEW_NOTES_MAX_LENGTH = 2000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isInterviewStage(value) {
  return INTERVIEW_STAGES.includes(value);
}

// Display label for a stored stage, or null for an unset/unknown value so the
// UI can decide how to render "not scheduled".
export function getInterviewStageLabel(stage) {
  return INTERVIEW_STAGE_LABELS[stage] ?? null;
}

// A real calendar date in strict YYYY-MM-DD form. Round-trips through Date so
// impossible dates (e.g. 2026-02-31) are rejected, not silently rolled over.
export function isValidInterviewDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Normalize raw interview form fields into a storable row patch.
 *
 * Empty/whitespace fields are allowed and become null (clearing the schedule).
 * A non-empty date must be a real YYYY-MM-DD; a non-empty stage must be a known
 * stage; notes are trimmed and length-capped. Returns `{ ok: true, value }` with
 * a `{ interview_date, interview_stage, interview_notes }` patch (each string or
 * null), or `{ ok: false, fieldErrors }` keyed by field name.
 *
 * @param {{ interview_date?: unknown, interview_stage?: unknown, interview_notes?: unknown }} raw
 * @returns {{ ok: true, value: { interview_date: string | null, interview_stage: string | null, interview_notes: string | null } } | { ok: false, fieldErrors: Record<string, string> }}
 */
export function normalizeInterviewSchedule(raw) {
  /** @type {Record<string, string>} */
  const fieldErrors = {};

  const rawDate = typeof raw?.interview_date === "string" ? raw.interview_date.trim() : "";
  let interview_date = null;
  if (rawDate.length > 0) {
    if (isValidInterviewDate(rawDate)) {
      interview_date = rawDate;
    } else {
      fieldErrors.interview_date = "Enter a valid date.";
    }
  }

  const rawStage = typeof raw?.interview_stage === "string" ? raw.interview_stage.trim() : "";
  let interview_stage = null;
  if (rawStage.length > 0) {
    if (isInterviewStage(rawStage)) {
      interview_stage = rawStage;
    } else {
      fieldErrors.interview_stage = "Choose a valid interview stage.";
    }
  }

  const rawNotes = typeof raw?.interview_notes === "string" ? raw.interview_notes.trim() : "";
  let interview_notes = null;
  if (rawNotes.length > 0) {
    if (rawNotes.length <= INTERVIEW_NOTES_MAX_LENGTH) {
      interview_notes = rawNotes;
    } else {
      fieldErrors.interview_notes = `Keep interview notes under ${INTERVIEW_NOTES_MAX_LENGTH} characters.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, value: { interview_date, interview_stage, interview_notes } };
}

// True when a row carries any interview scheduling detail — lets the UI show a
// compact summary vs. an empty "Schedule" affordance without re-deriving it.
export function hasInterviewSchedule(row) {
  return Boolean(row?.interview_date || row?.interview_stage || row?.interview_notes);
}
