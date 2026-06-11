import assert from "node:assert/strict";
import test from "node:test";

import {
  LABEL_EMPHASIS,
  MATCH_TABS,
  emphasisForLabel,
  isTabEmphasized,
  matchTabHref,
  tabForPathname,
} from "../src/lib/match-tabs.mjs";
import { roadmapEntryFromRuns } from "../src/lib/analysis-package-view.mjs";

const ALL_LABELS = [
  "strong_apply",
  "apply_with_improvements",
  "learning_target",
  "not_recommended",
];

test("the six tabs render in a fixed, label-independent order", () => {
  assert.deepEqual(
    MATCH_TABS.map((t) => t.key),
    ["overview", "gaps", "resume", "materials", "interview", "advanced"]
  );
  // The debug tab is displayed as "Advanced", never "Analysis Details".
  const advanced = MATCH_TABS.find((t) => t.key === "advanced");
  assert.equal(advanced.label, "Advanced");
  assert.deepEqual(
    MATCH_TABS.map((t) => t.label),
    ["Overview", "Skill Gaps", "Resume Strategy", "Application Materials", "Interview Prep", "Advanced"]
  );
});

test("tab order is identical for every decision label (emphasis never reorders)", () => {
  // Emphasis is a separate concern from order; assert order is a constant.
  const order = MATCH_TABS.map((t) => t.key);
  for (const label of ALL_LABELS) {
    // Emphasis returns a subset of the fixed keys — it can't introduce new tabs.
    for (const key of emphasisForLabel(label)) {
      assert.ok(order.includes(key), `emphasis key ${key} must be a real tab`);
    }
  }
});

test("matchTabHref builds the overview base route and the sub-routes", () => {
  assert.equal(matchTabHref("m1", MATCH_TABS[0]), "/matches/m1");
  assert.equal(matchTabHref("m1", MATCH_TABS[1]), "/matches/m1/gaps");
  assert.equal(matchTabHref("m1", MATCH_TABS[2]), "/matches/m1/resume-suggestions");
  assert.equal(matchTabHref("m1", MATCH_TABS[3]), "/matches/m1/draft-cv");
  assert.equal(matchTabHref("m1", MATCH_TABS[4]), "/matches/m1/interview-prep");
  assert.equal(matchTabHref("m1", MATCH_TABS[5]), "/matches/m1/advanced");
});

test("tabForPathname resolves the active tab, including secondary sub-routes", () => {
  assert.equal(tabForPathname("/matches/m1", "m1"), "overview");
  assert.equal(tabForPathname("/matches/m1/", "m1"), "overview");
  assert.equal(tabForPathname("/matches/m1/gaps", "m1"), "gaps");
  assert.equal(tabForPathname("/matches/m1/resume-suggestions", "m1"), "resume");
  // The older tailored-resume route still lights up Resume Strategy.
  assert.equal(tabForPathname("/matches/m1/resume-draft", "m1"), "resume");
  assert.equal(tabForPathname("/matches/m1/draft-cv", "m1"), "materials");
  // Cover letter shares the Application Materials tab.
  assert.equal(tabForPathname("/matches/m1/cover-letter", "m1"), "materials");
  assert.equal(tabForPathname("/matches/m1/interview-prep", "m1"), "interview");
  assert.equal(tabForPathname("/matches/m1/advanced", "m1"), "advanced");
});

test("the roadmap route maps to no tab — it has no tab of its own", () => {
  assert.equal(tabForPathname("/matches/m1/roadmap", "m1"), null);
});

test("tabForPathname ignores routes for other matches or other surfaces", () => {
  assert.equal(tabForPathname("/matches/other/gaps", "m1"), null);
  assert.equal(tabForPathname("/matches", "m1"), null);
  assert.equal(tabForPathname("/profile", "m1"), null);
  assert.equal(tabForPathname(undefined, "m1"), null);
  assert.equal(tabForPathname("/matches/m1/gaps", ""), null);
});

test("emphasis maps each label to existing tab keys, varying by label", () => {
  assert.deepEqual(emphasisForLabel("strong_apply"), ["materials", "interview"]);
  assert.deepEqual(emphasisForLabel("apply_with_improvements"), ["resume", "gaps"]);
  assert.deepEqual(emphasisForLabel("learning_target"), ["gaps"]);
  assert.deepEqual(emphasisForLabel("not_recommended"), ["overview"]);
  assert.deepEqual(emphasisForLabel("nonsense"), []);
  // Every label has an entry.
  for (const label of ALL_LABELS) {
    assert.ok(Array.isArray(LABEL_EMPHASIS[label]));
  }
});

test("isTabEmphasized answers per (label, tab)", () => {
  assert.equal(isTabEmphasized("strong_apply", "materials"), true);
  assert.equal(isTabEmphasized("strong_apply", "gaps"), false);
  assert.equal(isTabEmphasized("learning_target", "gaps"), true);
  assert.equal(isTabEmphasized(null, "gaps"), false);
});

test("roadmapEntryFromRuns surfaces the newest completed roadmap, else null", () => {
  assert.equal(roadmapEntryFromRuns([]), null);
  assert.equal(roadmapEntryFromRuns(undefined), null);
  // A queued/running roadmap run is not yet a generated artifact.
  assert.equal(
    roadmapEntryFromRuns([{ workflow_type: "roadmap", status: "running", completed_at: null }]),
    null
  );
  // Other completed steps don't count.
  assert.equal(
    roadmapEntryFromRuns([{ workflow_type: "match_analysis", status: "completed", completed_at: "2026-06-08" }]),
    null
  );
  const entry = roadmapEntryFromRuns([
    { workflow_type: "roadmap", status: "completed", completed_at: "2026-06-06" },
    { workflow_type: "roadmap", status: "completed", completed_at: "2026-06-08" },
  ]);
  assert.deepEqual(entry, { generatedAt: "2026-06-08" });
});
