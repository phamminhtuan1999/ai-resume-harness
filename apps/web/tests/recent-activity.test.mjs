import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  formatRelativeTime,
  groupActivities,
  importanceVariant,
  normalizeActivity,
  paginationMeta,
  stepLabel,
} from "../src/lib/activity-feed.mjs";
import {
  fetchActivityFeed,
  regenerateActivityDescription,
} from "../src/lib/ai-workflow-client.mjs";

function fakeFetch(status, payload) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

test("importance maps to design-system badge variants", () => {
  assert.equal(importanceVariant("high"), "warning");
  assert.equal(importanceVariant("medium"), "info");
  assert.equal(importanceVariant("low"), "secondary");
  assert.equal(importanceVariant("bogus"), "secondary");
});

test("relative time formats recent and older timestamps", () => {
  const now = Date.parse("2026-06-09T12:00:00Z");
  assert.equal(formatRelativeTime("2026-06-09T11:59:40Z", now), "just now");
  assert.equal(formatRelativeTime("2026-06-09T10:00:00Z", now), "2 hours ago");
  assert.equal(formatRelativeTime("2026-06-07T12:00:00Z", now), "2 days ago");
  assert.equal(formatRelativeTime("not-a-date", now), "");
});

test("normalizeActivity fills defaults and keeps related job", () => {
  const view = normalizeActivity({
    id: "act_1",
    activity_type: "match_analysis.completed",
    title: " Match Analysis ",
    assistant_description: "ApplyWise scored the role at 78%.",
    importance: "high",
    created_at: "2026-06-08T10:32:14Z",
    related_job: { id: "job_1", title: "AI Engineer", company: "Acme" },
  });
  assert.equal(view.title, "Match Analysis");
  assert.equal(view.related_job.company, "Acme");

  const empty = normalizeActivity({ importance: "bogus" });
  assert.equal(empty.title, "Activity");
  assert.equal(empty.importance, "low");
  assert.equal(empty.related_job, null);
});

test("fetchActivityFeed maps the response and handles errors", async () => {
  const ok = await fetchActivityFeed({
    apiBaseUrl: "http://api",
    sessionToken: "token",
    fetchImpl: fakeFetch(200, { activities: [{ id: "a" }], total: 7 }),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.total, 7);
  assert.equal(ok.activities.length, 1);

  const failed = await fetchActivityFeed({
    apiBaseUrl: "http://api",
    sessionToken: "token",
    fetchImpl: fakeFetch(503, {
      error: { code: "network_failure", message: "Down.", retryable: true },
    }),
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.retryable, true);
});

test("the dashboard has no activity feed; the grouped feed lives on /activity", () => {
  const dashboard = readFileSync(
    join(process.cwd(), "src", "app", "(app)", "dashboard", "page.tsx"),
    "utf8"
  );
  // The AI summary card is the dashboard's activity story; no raw feed, no
  // static implemented badges.
  assert.doesNotMatch(dashboard, /RecentActivity|getRecentActivities/);
  assert.doesNotMatch(dashboard, /implemented/);

  const activityPage = readFileSync(
    join(process.cwd(), "src", "app", "(app)", "activity", "page.tsx"),
    "utf8"
  );
  // History pages render as table lists with shared header/empty-state, with
  // run-full bursts grouped.
  assert.match(activityPage, /PageHeader/);
  assert.match(activityPage, /<Table>/);
  assert.match(activityPage, /EmptyState/);
  assert.match(activityPage, /groupActivities/);
});

test("generic fallback descriptions are suppressed in views", () => {
  const view = normalizeActivity({
    id: "act_1",
    title: "ApplyWise recommends: build project first.",
    assistant_description: "ApplyWise completed a assistant insight workflow.",
    importance: "medium",
  });
  assert.equal(view.assistant_description, "");

  const fixed = normalizeActivity({
    id: "act_2",
    title: "T",
    assistant_description: "ApplyWise completed an interview prep workflow.",
  });
  assert.equal(fixed.assistant_description, "");

  const real = normalizeActivity({
    id: "act_3",
    title: "T",
    assistant_description: "ApplyWise scored the role at 78%.",
  });
  assert.equal(real.assistant_description, "ApplyWise scored the role at 78%.");
});

test("groupActivities collapses same-job run bursts into one headline entry", () => {
  const job = { id: "job_1", title: "CTO", company: "Geovea" };
  const rows = [
    // Newest first: a run-full burst for job_1 over a few minutes...
    {
      id: "a6",
      activity_type: "assistant_insight.completed",
      title: "ApplyWise recommends: build project first.",
      importance: "medium",
      created_at: "2026-06-09T10:06:00Z",
      related_job: job,
    },
    {
      id: "a5",
      activity_type: "interview_prep.completed",
      title: "ApplyWise prepared interview questions.",
      importance: "high",
      created_at: "2026-06-09T10:05:00Z",
      related_job: job,
    },
    {
      id: "a4",
      activity_type: "roadmap.completed",
      title: "ApplyWise built a roadmap.",
      importance: "medium",
      created_at: "2026-06-09T10:04:00Z",
      related_job: job,
    },
    // ...an unrelated user-scoped event...
    {
      id: "a3",
      activity_type: "dashboard_summary.completed",
      title: "ApplyWise summarized your job search.",
      importance: "medium",
      created_at: "2026-06-09T10:03:00Z",
      related_job: null,
    },
    // ...and an old event for the same job, outside the window.
    {
      id: "a1",
      activity_type: "match_analysis.completed",
      title: "ApplyWise scored the role at 52%.",
      importance: "medium",
      created_at: "2026-06-09T07:00:00Z",
      related_job: job,
    },
  ];

  const groups = groupActivities(rows);
  assert.equal(groups.length, 3);

  const burst = groups[0];
  assert.equal(burst.count, 3);
  // Headline is the highest-importance event of the burst...
  assert.equal(burst.id, "a5");
  assert.equal(burst.importance, "high");
  // ...timestamped by the newest event, with the rest as labels.
  assert.equal(burst.created_at, "2026-06-09T10:06:00Z");
  assert.deepEqual(burst.also_ran, ["Assistant insight", "Roadmap"]);
  assert.equal(burst.related_job.id, "job_1");

  assert.equal(groups[1].id, "a3");
  assert.equal(groups[1].count, 1);
  assert.deepEqual(groups[1].also_ran, []);
  assert.equal(groups[2].id, "a1"); // outside the window -> its own entry
});

test("paginationMeta computes ranges and clamps out-of-range pages", () => {
  assert.deepEqual(paginationMeta({ page: 2, pageSize: 20, total: 45 }), {
    page: 2,
    pageSize: 20,
    total: 45,
    totalPages: 3,
    offset: 20,
    start: 21,
    end: 40,
    hasPrev: true,
    hasNext: true,
  });

  // Out-of-range and junk pages clamp into the valid range.
  assert.equal(paginationMeta({ page: 99, pageSize: 20, total: 45 }).page, 3);
  assert.equal(paginationMeta({ page: 0, pageSize: 20, total: 45 }).page, 1);
  assert.equal(paginationMeta({ page: "junk", pageSize: 20, total: 45 }).page, 1);

  // Empty feed: one page, nothing to show, no links.
  const empty = paginationMeta({ page: 1, pageSize: 20, total: 0 });
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.equal(empty.hasPrev, false);
  assert.equal(empty.hasNext, false);
});

test("stepLabel maps workflow types to friendly names", () => {
  assert.equal(stepLabel("missing_skills.completed"), "Missing skills");
  assert.equal(stepLabel("cover_letter.failed"), "Cover letter");
  assert.equal(stepLabel("custom_thing.completed"), "custom thing");
});

test("regenerateActivityDescription returns the updated activity or a typed error", async () => {
  const ok = await regenerateActivityDescription({
    apiBaseUrl: "http://api",
    activityId: "act_1",
    sessionToken: "token",
    fetchImpl: fakeFetch(200, { activity: { id: "act_1", title: "Updated" } }),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.activity.title, "Updated");

  const denied = await regenerateActivityDescription({
    apiBaseUrl: "http://api",
    activityId: "act_1",
    sessionToken: "token",
    fetchImpl: fakeFetch(403, {
      error: { code: "unauthorized", message: "Not yours.", retryable: false },
    }),
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.message, "Not yours.");
  assert.equal(denied.retryable, false);
});
