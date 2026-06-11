import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE_WORKFLOW_TYPES,
  isCoreChainRunning,
  refreshResultBanner,
} from "../src/lib/refresh-view.mjs";

test("the core chain is the three decision steps only", () => {
  assert.deepEqual(CORE_WORKFLOW_TYPES, [
    "match_analysis",
    "missing_skills",
    "assistant_insight",
  ]);
});

test("isCoreChainRunning is true while any core step is queued/running", () => {
  assert.equal(
    isCoreChainRunning([{ workflow_type: "match_analysis", status: "running" }]),
    true
  );
  assert.equal(
    isCoreChainRunning([{ workflow_type: "missing_skills", status: "queued" }]),
    true
  );
});

test("isCoreChainRunning ignores completed core steps and running downstream steps", () => {
  assert.equal(
    isCoreChainRunning([
      { workflow_type: "match_analysis", status: "completed" },
      { workflow_type: "assistant_insight", status: "completed" },
    ]),
    false
  );
  // A downstream artifact regenerating is not the decision core chain.
  assert.equal(
    isCoreChainRunning([{ workflow_type: "cover_letter", status: "running" }]),
    false
  );
  assert.equal(isCoreChainRunning([]), false);
  assert.equal(isCoreChainRunning(undefined), false);
});

test("the result banner announces a changed verdict with both display labels", () => {
  const banner = refreshResultBanner("learning_target", "apply_with_improvements");
  assert.equal(banner.kind, "changed");
  assert.match(banner.message, /Learning Target/);
  assert.match(banner.message, /Apply With Improvements/);
});

test("the result banner confirms when the verdict held", () => {
  const same = refreshResultBanner("strong_apply", "strong_apply");
  assert.equal(same.kind, "unchanged");
  assert.match(same.message, /same recommendation/i);

  // No prior label (first decision) reads as unchanged, not a false transition.
  const firstRun = refreshResultBanner(null, "strong_apply");
  assert.equal(firstRun.kind, "unchanged");
});
