import assert from "node:assert/strict";
import test from "node:test";

import { countActiveApplications } from "../src/lib/application-tracker.mjs";
import { buildInterviewAgenda } from "../src/lib/interview-calendar.mjs";

function row(overrides) {
  return {
    id: overrides.id ?? "app-1",
    job_id: overrides.job_id ?? "job-1",
    match_id: overrides.match_id ?? null,
    status: overrides.status ?? "interviewing",
    interview_date: overrides.interview_date ?? null,
    interview_stage: overrides.interview_stage ?? null,
    interview_notes: overrides.interview_notes ?? null,
    jobs: "jobs" in overrides ? overrides.jobs : { company: "Acme", title: "Engineer" },
  };
}

test("groups scheduled interviews by date in chronological order", () => {
  const agenda = buildInterviewAgenda([
    row({ id: "b", interview_date: "2026-07-10" }),
    row({ id: "a", interview_date: "2026-07-01" }),
    row({ id: "c", interview_date: "2026-07-20" }),
  ]);

  assert.equal(agenda.isEmpty, false);
  assert.equal(agenda.totalEvents, 3);
  assert.deepEqual(
    agenda.groups.map((group) => group.date),
    ["2026-07-01", "2026-07-10", "2026-07-20"],
  );
});

test("multiple interviews on the same date share one group, ordered deterministically", () => {
  const agenda = buildInterviewAgenda([
    row({ id: "z", interview_date: "2026-07-01", jobs: { company: "Zeta", title: "Dev" } }),
    row({ id: "a", interview_date: "2026-07-01", jobs: { company: "Acme", title: "Dev" } }),
    row({ id: "a2", interview_date: "2026-07-01", jobs: { company: "Acme", title: "Architect" } }),
  ]);

  assert.equal(agenda.groups.length, 1);
  const group = agenda.groups[0];
  assert.equal(group.events.length, 3);
  // company then title: Acme/Architect, Acme/Dev, Zeta/Dev.
  assert.deepEqual(
    group.events.map((event) => `${event.company}/${event.title}`),
    ["Acme/Architect", "Acme/Dev", "Zeta/Dev"],
  );
});

test("rows without a real interview_date are excluded (never derived from applied_date)", () => {
  const agenda = buildInterviewAgenda([
    row({ id: "null", interview_date: null }),
    row({ id: "empty", interview_date: "   " }),
    row({ id: "impossible", interview_date: "2026-02-31" }),
    row({ id: "badformat", interview_date: "07/01/2026" }),
    // An applied row with no interview date must NOT become an agenda event.
    row({ id: "applied-only", status: "applied", interview_date: null }),
    row({ id: "ok", interview_date: "2026-07-01" }),
  ]);

  assert.equal(agenda.totalEvents, 1);
  assert.equal(agenda.groups[0].events[0].applicationId, "ok");
});

test("empty input yields an empty agenda, not a crash", () => {
  for (const input of [[], null, undefined, "nope"]) {
    const agenda = buildInterviewAgenda(input);
    assert.equal(agenda.isEmpty, true);
    assert.equal(agenda.totalEvents, 0);
    assert.deepEqual(agenda.groups, []);
  }
});

test("event carries stage label, navigation ids, notes, and job context", () => {
  const agenda = buildInterviewAgenda([
    row({
      id: "app-9",
      job_id: "job-9",
      match_id: "match-9",
      interview_date: "2026-07-01",
      interview_stage: "system_design",
      interview_notes: "  Review the sharding doc  ",
      jobs: { company: "Globex", title: "Staff Engineer" },
    }),
  ]);

  const event = agenda.groups[0].events[0];
  assert.equal(event.applicationId, "app-9");
  assert.equal(event.jobId, "job-9");
  assert.equal(event.matchId, "match-9");
  assert.equal(event.company, "Globex");
  assert.equal(event.title, "Staff Engineer");
  assert.equal(event.stage, "system_design");
  assert.equal(event.stageLabel, "System design");
  assert.equal(event.notes, "Review the sharding doc");
});

test("unknown / unset stage resolves to a null label so the UI can omit it", () => {
  const agenda = buildInterviewAgenda([
    row({ interview_date: "2026-07-01", interview_stage: null }),
    row({ id: "x", interview_date: "2026-07-02", interview_stage: "vibes" }),
  ]);

  assert.equal(agenda.groups[0].events[0].stageLabel, null);
  assert.equal(agenda.groups[1].events[0].stage, "vibes");
  assert.equal(agenda.groups[1].events[0].stageLabel, null);
});

test("missing job falls back to placeholder company/title", () => {
  const agenda = buildInterviewAgenda([
    row({ interview_date: "2026-07-01", jobs: null }),
  ]);
  const event = agenda.groups[0].events[0];
  assert.equal(event.company, "Unknown company");
  assert.equal(event.title, "Unknown role");
});

test("a Learning Target with an interview date appears but is never counted active", () => {
  const rows = [
    row({ id: "active", status: "interviewing", interview_date: "2026-07-01" }),
    row({ id: "lt", status: "learning_target", interview_date: "2026-07-05" }),
  ];

  const agenda = buildInterviewAgenda(rows);
  // Both scheduled interviews show on the agenda...
  assert.equal(agenda.totalEvents, 2);
  const learningEvent = agenda.groups.find((g) => g.date === "2026-07-05").events[0];
  assert.equal(learningEvent.isLearningTarget, true);
  // ...but the learning target never inflates the active pipeline count.
  assert.equal(countActiveApplications(rows), 1);
});

test("today reference flags past/today groups and counts upcoming events", () => {
  const agenda = buildInterviewAgenda(
    [
      row({ id: "past", interview_date: "2026-06-01" }),
      row({ id: "today", interview_date: "2026-06-17" }),
      row({ id: "future", interview_date: "2026-07-01" }),
    ],
    { today: "2026-06-17" },
  );

  const [past, todayGroup, future] = agenda.groups;
  assert.deepEqual([past.isPast, past.isToday], [true, false]);
  assert.deepEqual([todayGroup.isPast, todayGroup.isToday], [false, true]);
  assert.deepEqual([future.isPast, future.isToday], [false, false]);
  // Upcoming = today and later.
  assert.equal(agenda.upcomingCount, 2);
});

test("without a today reference no group is flagged and upcoming equals total", () => {
  const agenda = buildInterviewAgenda([
    row({ id: "a", interview_date: "2026-06-01" }),
    row({ id: "b", interview_date: "2026-07-01" }),
  ]);

  assert.ok(agenda.groups.every((group) => group.isPast === false && group.isToday === false));
  assert.equal(agenda.upcomingCount, agenda.totalEvents);
});
