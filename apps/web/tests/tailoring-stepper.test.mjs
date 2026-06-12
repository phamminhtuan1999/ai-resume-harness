import assert from "node:assert/strict";
import test from "node:test";

import {
  TAILORING_STEPS,
  currentStep,
  stepHref,
  stepStates,
} from "../src/lib/tailoring-stepper.mjs";

test("five fixed steps spanning the two tabs", () => {
  assert.deepEqual(
    TAILORING_STEPS.map((step) => step.key),
    ["suggest", "respond", "generate", "final_check", "export"]
  );
  assert.deepEqual(
    TAILORING_STEPS.map((step) => step.segment),
    [
      "resume-suggestions",
      "resume-suggestions",
      "draft-cv",
      "draft-cv",
      "draft-cv",
    ]
  );
});

test("currentStep walks the journey from artifacts", () => {
  // Nothing yet -> Suggest.
  assert.equal(
    currentStep({ suggestionCount: 0, respondedCount: 0, hasDraft: false, draftStatus: null }),
    "suggest"
  );
  // Suggestions exist with unreviewed items -> Respond.
  assert.equal(
    currentStep({ suggestionCount: 4, respondedCount: 1, hasDraft: false, draftStatus: null }),
    "respond"
  );
  // Everything responded, no CV yet -> Generate.
  assert.equal(
    currentStep({ suggestionCount: 4, respondedCount: 4, hasDraft: false, draftStatus: null }),
    "generate"
  );
  // A CV exists -> Final check, regardless of suggestion counts.
  assert.equal(
    currentStep({ suggestionCount: 4, respondedCount: 1, hasDraft: true, draftStatus: "needs_review" }),
    "final_check"
  );
  // Review clean -> the next action is exporting.
  assert.equal(
    currentStep({ suggestionCount: 4, respondedCount: 4, hasDraft: true, draftStatus: "ready_to_export" }),
    "export"
  );
  // Exported -> Export (rendered done by stepStates).
  assert.equal(
    currentStep({ suggestionCount: 4, respondedCount: 4, hasDraft: true, draftStatus: "exported" }),
    "export"
  );
});

test("a draft generated without suggestions still lands on Final check", () => {
  assert.equal(
    currentStep({ suggestionCount: 0, respondedCount: 0, hasDraft: true, draftStatus: "draft" }),
    "final_check"
  );
});

test("stepStates marks done/current/todo around the active step", () => {
  const states = stepStates({
    suggestionCount: 3,
    respondedCount: 1,
    hasDraft: false,
    draftStatus: null,
  });
  assert.deepEqual(
    states.map((step) => step.state),
    ["done", "current", "todo", "todo", "todo"]
  );
});

test("an exported draft completes the journey — all five steps are done", () => {
  const states = stepStates({
    suggestionCount: 3,
    respondedCount: 3,
    hasDraft: true,
    draftStatus: "exported",
  });
  assert.deepEqual(
    states.map((step) => step.state),
    ["done", "done", "done", "done", "done"]
  );
  // Not exported yet -> Export stays the highlighted current step.
  const beforeExport = stepStates({
    suggestionCount: 3,
    respondedCount: 3,
    hasDraft: true,
    draftStatus: "ready_to_export",
  });
  assert.equal(beforeExport[4].state, "current");
});

test("stepHref routes into the owning sub-page", () => {
  assert.equal(stepHref("m1", TAILORING_STEPS[0]), "/matches/m1/resume-suggestions");
  assert.equal(stepHref("m1", TAILORING_STEPS[4]), "/matches/m1/draft-cv");
});
