import assert from "node:assert/strict";
import test from "node:test";

import {
  getWorkspaceCounts,
  getWorkspaceRecommendation,
} from "../src/lib/dashboard-summary.mjs";

test("workspace counts summarize saved profile resume and job totals", () => {
  assert.deepEqual(
    getWorkspaceCounts({
      profile: { id: "profile_1" },
      resumes: [{ id: "resume_1" }],
      jobs: [{ id: "job_1" }, { id: "job_2" }],
    }),
    { profiles: 1, resumes: 1, jobs: 2 }
  );
});

test("workspace recommendation asks for inputs when resume or job is missing", () => {
  assert.deepEqual(
    getWorkspaceRecommendation({
      profile: { id: "profile_1" },
      resumes: [],
      jobs: [],
    }),
    {
      score: 34,
      label: "Add inputs",
      message: "Save at least one resume and one job description before match analysis.",
    }
  );
});

test("workspace recommendation is ready when at least one resume and one job exist", () => {
  assert.deepEqual(
    getWorkspaceRecommendation({
      profile: { id: "profile_1" },
      resumes: [{ id: "resume_1" }],
      jobs: [{ id: "job_1" }],
    }),
    {
      score: 100,
      label: "Ready to compare",
      message: "Resume and job inputs are saved. The next slice can generate match analysis.",
    }
  );
});
