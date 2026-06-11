import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYZED_JOBS_LABEL,
  JOB_ANALYSIS_LABEL,
  jobAnalysisBreadcrumb,
  matchListScore,
  matchListVerdict,
} from "../src/lib/matches-list-view.mjs";

test("the surface names are the US-053 copy (route paths unchanged)", () => {
  assert.equal(ANALYZED_JOBS_LABEL, "Analyzed Jobs");
  assert.equal(JOB_ANALYSIS_LABEL, "Job Analysis");
});

test("the breadcrumb reads Analyzed Jobs -> Job Analysis, first crumb links to /matches", () => {
  const crumbs = jobAnalysisBreadcrumb();
  assert.deepEqual(crumbs, [
    { label: "Analyzed Jobs", href: "/matches" },
    { label: "Job Analysis" },
  ]);
  // The terminal crumb is the current page — no href.
  assert.equal(crumbs[crumbs.length - 1].href, undefined);
});

test("the list verdict uses the decision vocabulary, or null for never-recomputed", () => {
  const strong = matchListVerdict("strong_apply");
  assert.equal(strong.display, "Strong Apply Target");
  assert.equal(strong.variant, "success");
  assert.equal(matchListVerdict("learning_target").display, "Learning Target");
  // No snapshot → null, so the caller falls back to the legacy badge.
  assert.equal(matchListVerdict(null), null);
  assert.equal(matchListVerdict(undefined), null);
  assert.equal(matchListVerdict("nonsense"), null);
});

test("the list score prefers the decision snapshot's score, rounding", () => {
  assert.equal(matchListScore(72.6, 70), 73);
  // No decision score → fall back to the match's overall score.
  assert.equal(matchListScore(null, 64), 64);
  assert.equal(matchListScore(undefined, 64.4), 64);
  // Neither present.
  assert.equal(matchListScore(null, null), null);
});
