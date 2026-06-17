// Single source of truth for the application-status vocabulary (decision 0009,
// refreshed by US-052). Storage values are lowercase machine strings; display
// labels render from APPLICATION_STATUS_LABELS. Forms, validation, the tracker
// page, the dashboard, and the node --test suite all read from here.

export const LEARNING_TARGET_STATUS = "learning_target";

export const APPLICATION_STATUSES = [
  "saved",
  "prepared",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "archived",
  "learning_target",
];

export const APPLICATION_STATUS_LABELS = {
  saved: "Saved",
  prepared: "Prepared",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  archived: "Archived",
  learning_target: "Learning Target",
};

// Status groups (US-052). "Active applications" are the pipeline group; closed
// rows have left the pipeline; the learning group is roles the user is building
// skills toward — tracked, but NOT active applications and never counted as one.
export const APPLICATION_STATUS_GROUPS = {
  pipeline: ["saved", "prepared", "applied", "interviewing", "offer"],
  closed: ["rejected", "archived"],
  learning: ["learning_target"],
};

// Active applications = the pipeline group only (decision 0009 / brief Epic 9).
export const ACTIVE_APPLICATION_STATUSES = APPLICATION_STATUS_GROUPS.pipeline;

// Statuses shown as the tracker's pipeline/closed summary cards — everything
// except the learning group, which gets its own segment.
export const TRACKED_STATUSES = [
  ...APPLICATION_STATUS_GROUPS.pipeline,
  ...APPLICATION_STATUS_GROUPS.closed,
];

export function isApplicationStatus(value) {
  return APPLICATION_STATUSES.includes(value);
}

export function getApplicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] ?? "Unknown";
}

export function isLearningTarget(status) {
  return status === LEARNING_TARGET_STATUS;
}

// "pipeline" | "closed" | "learning" | null
export function applicationStatusGroup(status) {
  for (const [group, members] of Object.entries(APPLICATION_STATUS_GROUPS)) {
    if (members.includes(status)) return group;
  }
  return null;
}

export function isActiveApplicationStatus(status) {
  return ACTIVE_APPLICATION_STATUSES.includes(status);
}

export function summarizeApplicationStatuses(applications) {
  const summary = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]));

  for (const application of applications) {
    if (isApplicationStatus(application.status)) {
      summary[application.status] += 1;
    }
  }

  return summary;
}

// Active-application count excludes the learning and closed groups — a learning
// target never inflates the pipeline (brief Epic 9 contract on every count).
export function countActiveApplications(applications) {
  const list = Array.isArray(applications) ? applications : [];
  return list.filter((a) => isActiveApplicationStatus(a?.status)).length;
}

// Status distribution + pipeline rollups for the tracker overview (US-080).
// Pure aggregation over loaded rows: per-status buckets (with display labels and
// group) plus active/closed/learning rollups, all derived from the shared status
// groups so a future status flows through here without new label code. Learning
// targets are NEVER counted as active applications. Unknown/unsupported status
// values are ignored (never counted), mirroring summarizeApplicationStatuses.
export function summarizeTrackerDistribution(applications) {
  const list = Array.isArray(applications) ? applications : [];
  const counts = summarizeApplicationStatuses(list);

  const buckets = APPLICATION_STATUSES.map((status) => ({
    status,
    label: getApplicationStatusLabel(status),
    group: applicationStatusGroup(status),
    count: counts[status],
  }));

  const rollups = { active: 0, closed: 0, learning: 0, total: 0 };
  for (const bucket of buckets) {
    if (bucket.group === "pipeline") rollups.active += bucket.count;
    else if (bucket.group === "closed") rollups.closed += bucket.count;
    else if (bucket.group === "learning") rollups.learning += bucket.count;
  }
  rollups.total = rollups.active + rollups.closed + rollups.learning;

  return { buckets, rollups, isEmpty: rollups.total === 0 };
}

// Split tracker rows for the two-segment tracker view: the pipeline/closed table
// vs. the dedicated Learning Targets segment.
export function partitionApplications(applications) {
  const tracked = [];
  const learningTargets = [];
  for (const application of Array.isArray(applications) ? applications : []) {
    if (isLearningTarget(application?.status)) {
      learningTargets.push(application);
    } else {
      tracked.push(application);
    }
  }
  return { tracked, learningTargets };
}

// Transition guard (US-052). Moves that don't touch the learning group keep the
// existing free-transition behavior. The learning group is guarded so a learning
// target is never silently treated as a live application: it can only be left for
// saved/applied/archived (decision 0015 §8 / design transition matrix). Entering
// learning_target from any status is allowed — it's always an explicit choice.
export function canChangeApplicationStatus(from, to) {
  if (!isApplicationStatus(to)) return false;
  if (from === LEARNING_TARGET_STATUS) {
    return ["learning_target", "saved", "applied", "archived"].includes(to);
  }
  return true;
}

// Plan a Save-as-Learning-Target upsert against any existing tracker row for the
// job. A row already in the pipeline (saved..offer) is a real application, so
// re-statusing it requires explicit confirm — no silent demotion. Closed and
// already-learning rows re-status without a prompt. No row → insert.
export function learningTargetSavePlan(existingStatus, confirmed) {
  if (!existingStatus) return "insert";
  if (existingStatus === LEARNING_TARGET_STATUS) return "update";
  if (APPLICATION_STATUS_GROUPS.pipeline.includes(existingStatus)) {
    return confirmed ? "update" : "needs_confirm";
  }
  // Closed (rejected/archived) or any unknown value: re-activating as a learning
  // target isn't a demotion, so no confirm needed.
  return "update";
}
