import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_APPLICATION_STATUSES,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_GROUPS,
  TRACKED_STATUSES,
  applicationStatusGroup,
  canChangeApplicationStatus,
  countActiveApplications,
  getApplicationStatusLabel,
  isApplicationStatus,
  isActiveApplicationStatus,
  isLearningTarget,
  learningTargetSavePlan,
  partitionApplications,
  summarizeApplicationStatuses,
  summarizeTrackerDistribution,
} from "../src/lib/application-tracker.mjs";

test("application tracker exposes the MVP status workflow", () => {
  // "prepared" added by US-038; "learning_target" added by US-052.
  assert.deepEqual(APPLICATION_STATUSES, [
    "saved",
    "prepared",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "archived",
    "learning_target",
  ]);
  assert.equal(getApplicationStatusLabel("prepared"), "Prepared");
  assert.equal(getApplicationStatusLabel("learning_target"), "Learning Target");
});

test("status groups: learning targets are tracked but not active applications", () => {
  assert.deepEqual(APPLICATION_STATUS_GROUPS.learning, ["learning_target"]);
  assert.equal(applicationStatusGroup("offer"), "pipeline");
  assert.equal(applicationStatusGroup("archived"), "closed");
  assert.equal(applicationStatusGroup("learning_target"), "learning");
  assert.equal(applicationStatusGroup("not-real"), null);

  // Learning targets are excluded from the active-application set and counts.
  assert.equal(isActiveApplicationStatus("applied"), true);
  assert.equal(isActiveApplicationStatus("learning_target"), false);
  assert.equal(isActiveApplicationStatus("archived"), false);
  assert.ok(!ACTIVE_APPLICATION_STATUSES.includes("learning_target"));
  assert.ok(!TRACKED_STATUSES.includes("learning_target"));
  assert.equal(isLearningTarget("learning_target"), true);
  assert.equal(isLearningTarget("saved"), false);

  const count = countActiveApplications([
    { status: "saved" },
    { status: "interviewing" },
    { status: "learning_target" },
    { status: "archived" },
  ]);
  assert.equal(count, 2); // saved + interviewing; learning_target and archived excluded
});

test("partitionApplications splits learning targets from the pipeline/closed rows", () => {
  const { tracked, learningTargets } = partitionApplications([
    { id: "1", status: "saved" },
    { id: "2", status: "learning_target" },
    { id: "3", status: "archived" },
    { id: "4", status: "learning_target" },
  ]);
  assert.deepEqual(
    tracked.map((a) => a.id),
    ["1", "3"]
  );
  assert.deepEqual(
    learningTargets.map((a) => a.id),
    ["2", "4"]
  );
});

test("transition guard only constrains moves out of learning_target", () => {
  // Non-learning moves keep the existing free-transition behavior.
  assert.equal(canChangeApplicationStatus("saved", "interviewing"), true);
  assert.equal(canChangeApplicationStatus("applied", "offer"), true);
  // Any status may become a learning target (always an explicit choice).
  assert.equal(canChangeApplicationStatus("interviewing", "learning_target"), true);
  // A learning target may only leave for saved / applied / archived.
  assert.equal(canChangeApplicationStatus("learning_target", "saved"), true);
  assert.equal(canChangeApplicationStatus("learning_target", "applied"), true);
  assert.equal(canChangeApplicationStatus("learning_target", "archived"), true);
  assert.equal(canChangeApplicationStatus("learning_target", "interviewing"), false);
  assert.equal(canChangeApplicationStatus("learning_target", "offer"), false);
  // Unknown targets are always rejected.
  assert.equal(canChangeApplicationStatus("saved", "not-real"), false);
});

test("learningTargetSavePlan demotes silently only from non-pipeline rows", () => {
  // No existing row → insert.
  assert.equal(learningTargetSavePlan(undefined, false), "insert");
  assert.equal(learningTargetSavePlan(null, false), "insert");
  // Already a learning target → idempotent update, no confirm.
  assert.equal(learningTargetSavePlan("learning_target", false), "update");
  // Closed rows re-activate without a prompt (not a demotion).
  assert.equal(learningTargetSavePlan("archived", false), "update");
  assert.equal(learningTargetSavePlan("rejected", false), "update");
  // Pipeline rows require explicit confirm — no silent demotion.
  assert.equal(learningTargetSavePlan("saved", false), "needs_confirm");
  assert.equal(learningTargetSavePlan("interviewing", false), "needs_confirm");
  assert.equal(learningTargetSavePlan("offer", false), "needs_confirm");
  assert.equal(learningTargetSavePlan("interviewing", true), "update");
});

test("application tracker labels machine statuses for the UI", () => {
  assert.equal(getApplicationStatusLabel("saved"), "Saved");
  assert.equal(getApplicationStatusLabel("interviewing"), "Interviewing");
  assert.equal(getApplicationStatusLabel("unknown"), "Unknown");
});

test("application tracker summarizes only valid statuses", () => {
  const summary = summarizeApplicationStatuses([
    { status: "saved" },
    { status: "saved" },
    { status: "applied" },
    { status: "not-real" },
  ]);

  assert.equal(summary.saved, 2);
  assert.equal(summary.applied, 1);
  assert.equal(summary.archived, 0);
  assert.equal(isApplicationStatus("offer"), true);
  assert.equal(isApplicationStatus("not-real"), false);
});

// --- summarizeTrackerDistribution (US-080) ---

const mixedRows = [
  { status: "saved" },
  { status: "applied" },
  { status: "applied" },
  { status: "interviewing" },
  { status: "offer" },
  { status: "rejected" },
  { status: "archived" },
  { status: "learning_target" },
  { status: "learning_target" },
];

test("summarizeTrackerDistribution rolls up active/closed/learning from groups", () => {
  const { rollups } = summarizeTrackerDistribution(mixedRows);
  // active = pipeline only (saved, applied x2, interviewing, offer) = 5
  assert.equal(rollups.active, 5);
  // closed = rejected + archived = 2
  assert.equal(rollups.closed, 2);
  // learning = 2
  assert.equal(rollups.learning, 2);
  assert.equal(rollups.total, 9);
});

test("summarizeTrackerDistribution buckets carry counts, labels, and groups", () => {
  const { buckets } = summarizeTrackerDistribution(mixedRows);
  const applied = buckets.find((b) => b.status === "applied");
  assert.equal(applied.count, 2);
  assert.equal(applied.label, "Applied");
  assert.equal(applied.group, "pipeline");
  const learning = buckets.find((b) => b.status === "learning_target");
  assert.equal(learning.label, "Learning Target");
  assert.equal(learning.group, "learning");
  // Every status is represented (stable order), zero-count included.
  assert.equal(buckets.length, APPLICATION_STATUSES.length);
});

test("summarizeTrackerDistribution keeps learning targets out of active", () => {
  const { rollups, isEmpty } = summarizeTrackerDistribution([
    { status: "learning_target" },
    { status: "learning_target" },
  ]);
  assert.equal(rollups.active, 0);
  assert.equal(rollups.closed, 0);
  assert.equal(rollups.learning, 2);
  assert.equal(isEmpty, false);
});

test("summarizeTrackerDistribution reports an empty state for no rows", () => {
  const { rollups, isEmpty, buckets } = summarizeTrackerDistribution([]);
  assert.equal(isEmpty, true);
  assert.equal(rollups.total, 0);
  assert.ok(buckets.every((b) => b.count === 0));
});

test("summarizeTrackerDistribution ignores unknown/unsupported statuses", () => {
  const { rollups, isEmpty } = summarizeTrackerDistribution([
    { status: "applied" },
    { status: "ghosted" },
    { status: null },
    {},
  ]);
  // Only the valid "applied" row counts; junk statuses are dropped.
  assert.equal(rollups.active, 1);
  assert.equal(rollups.total, 1);
  assert.equal(isEmpty, false);
});

test("summarizeTrackerDistribution tolerates non-array input", () => {
  const { isEmpty, rollups } = summarizeTrackerDistribution(undefined);
  assert.equal(isEmpty, true);
  assert.equal(rollups.total, 0);
});
