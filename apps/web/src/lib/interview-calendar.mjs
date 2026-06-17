// Interview agenda builder for the tracker calendar view (US-083). Pure and
// deterministic so the server component, and the node --test suite, share one
// source of truth. It works over the rows already loaded by getTrackerData —
// those rows are owned-scoped at the loader (.eq user_id), so this layer only
// shapes them; it never reads the database itself.
//
// Product contract rules baked in here:
// - An event comes ONLY from a real interview_date. applied_date is a different
//   lifecycle event and never produces an agenda entry.
// - Rows with no / empty / impossible interview_date are not events.
// - Learning Targets with an interview_date DO appear (a scheduled date is a
//   scheduled date), but the agenda is not an "active application" view: each
//   event carries isLearningTarget so the UI can label it, and nothing here
//   counts a learning target toward the active pipeline.
// - Internal only: no external calendar sync, no reminders.

import {
  getInterviewStageLabel,
  isValidInterviewDate,
} from "./interview-schedule.mjs";
import { isLearningTarget } from "./application-tracker.mjs";

// ISO YYYY-MM-DD strings sort lexicographically in calendar order, so plain
// string compare gives chronological ordering and past/upcoming partitioning
// without constructing any Date (keeps the helper deterministic + tz-free).

/**
 * @typedef {Object} AgendaEvent
 * @property {string} date
 * @property {string | null} applicationId
 * @property {string | null} jobId
 * @property {string | null} matchId
 * @property {string} company
 * @property {string} title
 * @property {string | null} status
 * @property {string | null} stage
 * @property {string | null} stageLabel
 * @property {string | null} notes
 * @property {boolean} isLearningTarget
 */

/**
 * Build a chronological interview agenda from tracker rows.
 *
 * @param {ReadonlyArray<any>} applications tracker rows as loaded by getTrackerData
 * @param {{ today?: string | null }} [options] optional reference date
 *   (strict YYYY-MM-DD). When supplied, each group is flagged isPast / isToday
 *   and upcomingCount counts events on or after it. Omit for a pure agenda.
 */
export function buildInterviewAgenda(applications, options = {}) {
  const list = Array.isArray(applications) ? applications : [];
  const today =
    typeof options.today === "string" && isValidInterviewDate(options.today)
      ? options.today
      : null;

  /** @type {AgendaEvent[]} */
  const events = [];
  for (const application of list) {
    const date =
      typeof application?.interview_date === "string"
        ? application.interview_date.trim()
        : "";
    // Only a real scheduled date is an event — never applied_date, never junk.
    if (!isValidInterviewDate(date)) continue;

    const stage =
      typeof application?.interview_stage === "string" && application.interview_stage.trim()
        ? application.interview_stage.trim()
        : null;
    const notes =
      typeof application?.interview_notes === "string" && application.interview_notes.trim()
        ? application.interview_notes.trim()
        : null;

    events.push({
      date,
      applicationId: application?.id ?? null,
      jobId: application?.job_id ?? null,
      matchId: application?.match_id ?? null,
      company: application?.jobs?.company || "Unknown company",
      title: application?.jobs?.title || "Unknown role",
      status: application?.status ?? null,
      stage,
      stageLabel: getInterviewStageLabel(stage),
      notes,
      isLearningTarget: isLearningTarget(application?.status),
    });
  }

  // Group by date; dates ascending. Events within a date get a stable order
  // (company then title) so the rendered agenda doesn't reshuffle on reload.
  /** @type {Map<string, AgendaEvent[]>} */
  const byDate = new Map();
  for (const event of events) {
    const bucket = byDate.get(event.date);
    if (bucket) bucket.push(event);
    else byDate.set(event.date, [event]);
  }

  const groups = [...byDate.keys()].sort().map((date) => ({
    date,
    isPast: today ? date < today : false,
    isToday: today ? date === today : false,
    events: (byDate.get(date) ?? [])
      .slice()
      .sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title)),
  }));

  const upcomingCount = today
    ? events.filter((event) => event.date >= today).length
    : events.length;

  return {
    groups,
    totalEvents: events.length,
    upcomingCount,
    isEmpty: events.length === 0,
  };
}
