export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "archived",
];

export const APPLICATION_STATUS_LABELS = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  archived: "Archived",
};

export function isApplicationStatus(value) {
  return APPLICATION_STATUSES.includes(value);
}

export function getApplicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] ?? "Unknown";
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
