import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_JOB_INTAKE_TAB,
  JOB_INTAKE_TABS,
  isJobIntakeTab,
  resolveJobIntakeTab,
} from "../src/lib/job-intake-tabs.mjs";

test("the three intake tabs render in a fixed order with the spec labels", () => {
  assert.deepEqual(
    JOB_INTAKE_TABS.map((t) => t.key),
    ["search", "url", "manual"]
  );
  assert.deepEqual(
    JOB_INTAKE_TABS.map((t) => t.label),
    ["Search AI Jobs", "Import Job URL", "Paste Job Description"]
  );
});

test("the default tab is Search AI Jobs (spec §6)", () => {
  assert.equal(DEFAULT_JOB_INTAKE_TAB, "search");
  assert.ok(JOB_INTAKE_TABS.some((t) => t.key === DEFAULT_JOB_INTAKE_TAB));
});

test("isJobIntakeTab recognizes only the three known tabs", () => {
  for (const t of JOB_INTAKE_TABS) {
    assert.equal(isJobIntakeTab(t.key), true);
  }
  assert.equal(isJobIntakeTab("roadmap"), false);
  assert.equal(isJobIntakeTab(""), false);
  assert.equal(isJobIntakeTab(undefined), false);
});

test("resolveJobIntakeTab selects a known tab, else falls back to the default", () => {
  assert.equal(resolveJobIntakeTab("search"), "search");
  assert.equal(resolveJobIntakeTab("url"), "url");
  assert.equal(resolveJobIntakeTab("manual"), "manual");
  // Switching to a bad/stale value never renders an empty panel.
  assert.equal(resolveJobIntakeTab("nonsense"), DEFAULT_JOB_INTAKE_TAB);
  assert.equal(resolveJobIntakeTab(undefined), DEFAULT_JOB_INTAKE_TAB);
});
