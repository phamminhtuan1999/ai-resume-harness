import assert from "node:assert/strict";
import test from "node:test";

import {
  droppedRunsLine,
  historyTransition,
  inputFreshnessParts,
  rulesVersionChanged,
} from "../src/lib/history-view.mjs";

test("a changed verdict renders both display labels", () => {
  const t = historyTransition({ label: "apply_with_improvements", previous_label: "not_recommended" });
  assert.equal(t.changed, true);
  assert.equal(t.text, "Not Recommended Yet → Apply With Improvements");
});

test("an unchanged or first-run verdict is not a false transition", () => {
  assert.equal(historyTransition({ label: "strong_apply", previous_label: "strong_apply" }).changed, false);
  // First run: no previous label.
  assert.equal(historyTransition({ label: "strong_apply", previous_label: null }).changed, false);
  assert.equal(historyTransition({ label: "strong_apply" }).text, null);
});

test("the rules-version marker appears only between mixed-version entries", () => {
  assert.equal(rulesVersionChanged({ rules_version: "p11.r2" }, { rules_version: "p11.r1" }), true);
  assert.equal(rulesVersionChanged({ rules_version: "p11.r1" }, { rules_version: "p11.r1" }), false);
  // Missing versions never assert a change.
  assert.equal(rulesVersionChanged({ rules_version: "p11.r1" }, {}), false);
  assert.equal(rulesVersionChanged({}, {}), false);
});

test("input freshness lists present inputs, profile first, with raw timestamps", () => {
  const parts = inputFreshnessParts({
    inputs: {
      profile_updated_at: "2026-06-10T00:00:00Z",
      resume_updated_at: "2026-06-08T00:00:00Z",
      job_updated_at: null,
    },
  });
  assert.deepEqual(
    parts.map((p) => p.key),
    ["profile", "resume"]
  );
  assert.equal(parts[0].updatedAt, "2026-06-10T00:00:00Z");
  // No inputs → empty (the component renders an em dash).
  assert.deepEqual(inputFreshnessParts({ inputs: {} }), []);
  assert.deepEqual(inputFreshnessParts({}), []);
});

test("the dropped-runs line is surfaced — never a silent cap", () => {
  assert.equal(droppedRunsLine(0), null);
  assert.equal(droppedRunsLine(undefined), null);
  assert.equal(droppedRunsLine(1), "1 older run not shown");
  assert.equal(droppedRunsLine(12), "12 older runs not shown");
});
