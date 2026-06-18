import assert from "node:assert/strict";
import test from "node:test";

import { buildTrackerNextSteps } from "../src/lib/tracker-next-steps.mjs";

function app(overrides = {}) {
  return {
    id: overrides.id ?? "app-1",
    status: overrides.status ?? "saved",
    match_id: "match_id" in overrides ? overrides.match_id : null,
  };
}

test("Search AI jobs is offered only when a concrete route is supplied", () => {
  const rows = [app({ status: "saved", match_id: "m1" })];

  const withoutRoute = buildTrackerNextSteps(rows);
  assert.equal(
    withoutRoute.steps.find((s) => s.key === "search_ai_jobs"),
    undefined,
  );

  const blankRoute = buildTrackerNextSteps(rows, { searchJobsHref: "  " });
  assert.equal(
    blankRoute.steps.find((s) => s.key === "search_ai_jobs"),
    undefined,
  );

  const withRoute = buildTrackerNextSteps(rows, { searchJobsHref: "/jobs/search" });
  const search = withRoute.steps.find((s) => s.key === "search_ai_jobs");
  assert.ok(search);
  assert.equal(search.href, "/jobs/search");
});

test("counts active tracked jobs without a match as needing analysis", () => {
  const rows = [
    app({ id: "a", status: "saved", match_id: null }), // needs analysis
    app({ id: "b", status: "applied", match_id: null }), // needs analysis
    app({ id: "c", status: "saved", match_id: "m1" }), // already analyzed
    app({ id: "d", status: "rejected", match_id: null }), // closed, not a next step
    app({ id: "e", status: "learning_target", match_id: null }), // learning, not analysis
  ];

  const { steps } = buildTrackerNextSteps(rows);
  const analyze = steps.find((s) => s.key === "analyze_jobs");
  assert.ok(analyze);
  assert.equal(analyze.count, 2);
  assert.equal(analyze.href, "/jobs");
  assert.match(analyze.label, /2 tracked jobs/);
});

test("singular label when exactly one job needs analysis", () => {
  const { steps } = buildTrackerNextSteps([app({ status: "saved", match_id: null })]);
  const analyze = steps.find((s) => s.key === "analyze_jobs");
  assert.equal(analyze.count, 1);
  assert.match(analyze.label, /Analyze 1 tracked job$/);
});

test("a single Learning Target roadmap routes straight to that match's roadmap", () => {
  const { steps } = buildTrackerNextSteps([
    app({ status: "learning_target", match_id: "m-42" }),
  ]);
  const roadmaps = steps.find((s) => s.key === "continue_roadmaps");
  assert.ok(roadmaps);
  assert.equal(roadmaps.count, 1);
  assert.equal(roadmaps.href, "/matches/m-42/roadmap");
});

test("multiple Learning Target roadmaps route to the matches list, not a loop", () => {
  const { steps } = buildTrackerNextSteps([
    app({ id: "l1", status: "learning_target", match_id: "m1" }),
    app({ id: "l2", status: "learning_target", match_id: "m2" }),
  ]);
  const roadmaps = steps.find((s) => s.key === "continue_roadmaps");
  assert.equal(roadmaps.count, 2);
  assert.equal(roadmaps.href, "/matches");
});

test("a Learning Target without a match offers no roadmap route", () => {
  const { steps, isEmpty } = buildTrackerNextSteps([
    app({ status: "learning_target", match_id: null }),
  ]);
  assert.equal(
    steps.find((s) => s.key === "continue_roadmaps"),
    undefined,
  );
  assert.equal(isEmpty, true);
});

test("a tidy pipeline with no actionable routes yields a reachable empty state", () => {
  const rows = [
    app({ status: "saved", match_id: "m1" }), // analyzed
    app({ status: "applied", match_id: "m2" }), // analyzed
    app({ status: "rejected", match_id: null }), // closed
  ];
  const result = buildTrackerNextSteps(rows);
  assert.deepEqual(result.steps, []);
  assert.equal(result.isEmpty, true);
});

test("empty / non-array input is an empty panel, not a crash", () => {
  for (const input of [[], null, undefined, "nope"]) {
    const result = buildTrackerNextSteps(input);
    assert.equal(result.isEmpty, true);
    assert.deepEqual(result.steps, []);
  }
});

test("steps come in a deterministic priority order: search, analyze, roadmaps", () => {
  const rows = [
    app({ status: "saved", match_id: null }), // analyze
    app({ status: "learning_target", match_id: "m1" }), // roadmap
  ];
  const { steps } = buildTrackerNextSteps(rows, { searchJobsHref: "/jobs/search" });
  assert.deepEqual(
    steps.map((s) => s.key),
    ["search_ai_jobs", "analyze_jobs", "continue_roadmaps"],
  );
});
