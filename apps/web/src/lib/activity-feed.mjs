/*
  View helpers for the US-037 Recent Activity feed.
*/

// Importance badge variants: high=amber, medium=blue, low=muted (per flow §7).
const IMPORTANCE_VARIANTS = {
  high: "warning",
  medium: "info",
  low: "secondary",
};

export function importanceVariant(importance) {
  return IMPORTANCE_VARIANTS[importance] ?? "secondary";
}

const RELATIVE_STEPS = [
  { unit: "year", seconds: 31536000 },
  { unit: "month", seconds: 2592000 },
  { unit: "week", seconds: 604800 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

export function formatRelativeTime(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return "";
  }

  const elapsedSeconds = Math.round((now - time) / 1000);
  if (elapsedSeconds < 60) {
    return "just now";
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  for (const step of RELATIVE_STEPS) {
    if (Math.abs(elapsedSeconds) >= step.seconds) {
      return formatter.format(-Math.round(elapsedSeconds / step.seconds), step.unit);
    }
  }
  return "just now";
}

// The deterministic last-resort text ("ApplyWise completed a X workflow.")
// adds nothing under an already-informative title — suppress it in views.
const GENERIC_DESCRIPTION = /^ApplyWise completed an? [a-z ]+ workflow\.$/i;

export function normalizeActivity(row) {
  const data = row && typeof row === "object" ? row : {};
  const job =
    data.related_job && typeof data.related_job === "object" ? data.related_job : null;
  const description =
    typeof data.assistant_description === "string"
      ? data.assistant_description.trim()
      : "";

  return {
    id: String(data.id ?? ""),
    activity_type: String(data.activity_type ?? ""),
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Activity",
    assistant_description: GENERIC_DESCRIPTION.test(description) ? "" : description,
    importance: ["low", "medium", "high"].includes(data.importance)
      ? data.importance
      : "low",
    created_at: typeof data.created_at === "string" ? data.created_at : "",
    related_job: job
      ? {
          id: String(job.id ?? ""),
          title: String(job.title ?? ""),
          company: String(job.company ?? ""),
        }
      : null,
  };
}

const STEP_LABELS = {
  match_analysis: "Match analysis",
  missing_skills: "Missing skills",
  resume_suggestions: "Resume suggestions",
  resume_draft: "Resume draft",
  cover_letter: "Cover letter",
  roadmap: "Roadmap",
  interview_prep: "Interview prep",
  assistant_insight: "Assistant insight",
  dashboard_summary: "Job search summary",
  activity_description: "Activity description",
};

export function stepLabel(activityType) {
  const key = String(activityType ?? "").split(".")[0];
  return STEP_LABELS[key] ?? (key ? key.replace(/_/g, " ") : "AI step");
}

export function paginationMeta({ page = 1, pageSize = 20, total = 0 } = {}) {
  const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const requested = Math.trunc(Number(page)) || 1;
  const current = Math.min(Math.max(1, requested), totalPages);
  const offset = (current - 1) * pageSize;

  return {
    page: current,
    pageSize,
    total: safeTotal,
    totalPages,
    offset,
    start: safeTotal === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, safeTotal),
    hasPrev: current > 1,
    hasNext: current < totalPages,
  };
}

const IMPORTANCE_RANK = { low: 0, medium: 1, high: 2 };

// One run-full execution emits many events for the same job within seconds.
// Collapse same-job bursts into one entry: the highest-importance (then
// newest) event becomes the headline; the rest become "Also ran" labels.
export function groupActivities(rows, { windowMs = 30 * 60 * 1000 } = {}) {
  const items = (Array.isArray(rows) ? rows : []).map((row) => normalizeActivity(row));
  const groups = [];

  // Rows arrive newest-first; a burst chains while gaps stay inside the window.
  for (const item of items) {
    const key = item.related_job?.id || `type:${item.activity_type.split(".")[0]}`;
    const time = new Date(item.created_at).getTime();
    const group = groups.find(
      (candidate) =>
        candidate.key === key &&
        Number.isFinite(time) &&
        Number.isFinite(candidate.oldestTime) &&
        candidate.oldestTime - time <= windowMs
    );

    if (group) {
      group.items.push(item);
      group.oldestTime = Number.isFinite(time) ? time : group.oldestTime;
    } else {
      groups.push({ key, items: [item], oldestTime: time });
    }
  }

  return groups.map((group) => {
    const headline = [...group.items].sort(
      (a, b) => (IMPORTANCE_RANK[b.importance] ?? 0) - (IMPORTANCE_RANK[a.importance] ?? 0)
    )[0];
    const newest = group.items[0];
    const alsoRan = [
      ...new Set(
        group.items
          .filter((item) => item.id !== headline.id)
          .map((item) => stepLabel(item.activity_type))
      ),
    ];

    return {
      ...headline,
      created_at: newest.created_at,
      related_job: group.items.find((item) => item.related_job)?.related_job ?? null,
      count: group.items.length,
      also_ran: alsoRan,
    };
  });
}
