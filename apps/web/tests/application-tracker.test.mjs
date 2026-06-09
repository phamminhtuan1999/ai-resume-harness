import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_STATUSES,
  getApplicationStatusLabel,
  isApplicationStatus,
  summarizeApplicationStatuses,
} from "../src/lib/application-tracker.mjs";

test("application tracker exposes the MVP status workflow", () => {
  // "prepared" added by US-038: run-full completion marks an application Prepared.
  assert.deepEqual(APPLICATION_STATUSES, [
    "saved",
    "prepared",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "archived",
  ]);
  assert.equal(getApplicationStatusLabel("prepared"), "Prepared");
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
