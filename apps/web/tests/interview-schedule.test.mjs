import assert from "node:assert/strict";
import test from "node:test";

import { countActiveApplications } from "../src/lib/application-tracker.mjs";
import {
  INTERVIEW_NOTES_MAX_LENGTH,
  INTERVIEW_STAGES,
  getInterviewStageLabel,
  hasInterviewSchedule,
  isInterviewStage,
  isValidInterviewDate,
  normalizeInterviewSchedule,
} from "../src/lib/interview-schedule.mjs";

test("interview stage vocabulary and labels", () => {
  assert.ok(isInterviewStage("technical"));
  assert.ok(isInterviewStage("onsite"));
  assert.equal(isInterviewStage("coffee_chat"), false);
  assert.equal(isInterviewStage(""), false);
  assert.equal(getInterviewStageLabel("recruiter_screen"), "Recruiter screen");
  assert.equal(getInterviewStageLabel("final"), "Final round");
  // Unknown/unset stage has no label so the UI decides how to render it.
  assert.equal(getInterviewStageLabel("nope"), null);
  assert.equal(getInterviewStageLabel(null), null);
  // Every stage has a label.
  assert.ok(INTERVIEW_STAGES.every((stage) => typeof getInterviewStageLabel(stage) === "string"));
});

test("isValidInterviewDate accepts real ISO dates and rejects junk", () => {
  assert.ok(isValidInterviewDate("2026-07-01"));
  assert.ok(isValidInterviewDate("2026-12-31"));
  assert.equal(isValidInterviewDate("2026-02-31"), false); // not a real day
  assert.equal(isValidInterviewDate("2026-13-01"), false); // not a real month
  assert.equal(isValidInterviewDate("07/01/2026"), false); // wrong format
  assert.equal(isValidInterviewDate("2026-7-1"), false); // not zero-padded
  assert.equal(isValidInterviewDate(""), false);
  assert.equal(isValidInterviewDate(null), false);
});

test("normalizeInterviewSchedule accepts empty fields and clears to null", () => {
  const result = normalizeInterviewSchedule({
    interview_date: "",
    interview_stage: "",
    interview_notes: "   ",
  });
  assert.deepEqual(result, {
    ok: true,
    value: { interview_date: null, interview_stage: null, interview_notes: null },
  });
});

test("normalizeInterviewSchedule accepts a full valid schedule (trimmed)", () => {
  const result = normalizeInterviewSchedule({
    interview_date: " 2026-07-01 ",
    interview_stage: "technical",
    interview_notes: "  Bring the system-design notes  ",
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      interview_date: "2026-07-01",
      interview_stage: "technical",
      interview_notes: "Bring the system-design notes",
    },
  });
});

test("normalizeInterviewSchedule rejects an invalid date payload", () => {
  const result = normalizeInterviewSchedule({ interview_date: "2026-02-31" });
  assert.equal(result.ok, false);
  assert.equal(result.fieldErrors.interview_date, "Enter a valid date.");
});

test("normalizeInterviewSchedule rejects an unsupported stage", () => {
  const result = normalizeInterviewSchedule({ interview_stage: "vibes" });
  assert.equal(result.ok, false);
  assert.equal(result.fieldErrors.interview_stage, "Choose a valid interview stage.");
});

test("normalizeInterviewSchedule rejects over-long notes", () => {
  const result = normalizeInterviewSchedule({
    interview_notes: "x".repeat(INTERVIEW_NOTES_MAX_LENGTH + 1),
  });
  assert.equal(result.ok, false);
  assert.match(result.fieldErrors.interview_notes, /under \d+ characters/);
});

test("normalizeInterviewSchedule reports every invalid field at once", () => {
  const result = normalizeInterviewSchedule({
    interview_date: "nope",
    interview_stage: "vibes",
  });
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.interview_date);
  assert.ok(result.fieldErrors.interview_stage);
});

test("hasInterviewSchedule detects any populated field", () => {
  assert.equal(hasInterviewSchedule({}), false);
  assert.equal(hasInterviewSchedule(null), false);
  assert.equal(hasInterviewSchedule({ interview_date: "2026-07-01" }), true);
  assert.equal(hasInterviewSchedule({ interview_stage: "onsite" }), true);
  assert.equal(hasInterviewSchedule({ interview_notes: "call recruiter" }), true);
});

test("interview fields never move a learning target into the active count", () => {
  // A scheduled learning target is still a learning target — never active.
  const rows = [
    { status: "applied" },
    {
      status: "learning_target",
      interview_date: "2026-07-01",
      interview_stage: "technical",
      interview_notes: "exploratory chat",
    },
  ];
  assert.equal(countActiveApplications(rows), 1); // only the applied row
});
