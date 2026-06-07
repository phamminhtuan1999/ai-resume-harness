import assert from "node:assert/strict";
import test from "node:test";

import { buildFourWeekRoadmap } from "../src/lib/roadmap-generator.mjs";

test("roadmap generator returns exactly four weeks", () => {
  const roadmap = buildFourWeekRoadmap({
    profile: { target_role: "Applied AI Engineer" },
    job: { company: "Northstar AI", title: "Applied AI Engineer" },
    match: { missing_skills_json: [] },
  });

  assert.equal(roadmap.roadmap_json.weeks.length, 4);
  assert.equal(roadmap.roadmap_json.target_role, "Applied AI Engineer");
});

test("roadmap generator prioritizes critical missing skills first", () => {
  const roadmap = buildFourWeekRoadmap({
    profile: { target_role: "LLM Engineer" },
    job: { company: "Northstar AI", title: "LLM Engineer" },
    match: {
      missing_skills_json: [
        { skill: "observability", severity: "Medium" },
        { skill: "rag", severity: "Critical" },
        { skill: "embeddings", severity: "Critical" },
      ],
    },
  });

  assert.equal(roadmap.roadmap_json.weeks[0].skills_covered[0], "rag");
  assert.equal(roadmap.roadmap_json.weeks[0].priority, "Critical");
  assert.equal(roadmap.roadmap_json.weeks[1].skills_covered[0], "embeddings");
});

test("roadmap weeks include required fields", () => {
  const roadmap = buildFourWeekRoadmap({
    profile: { target_role: "AI Engineer" },
    job: { company: "Northstar AI", title: "AI Engineer" },
    match: { missing_skills_json: [{ skill: "evaluation", severity: "Critical" }] },
  });

  const week = roadmap.roadmap_json.weeks[0];
  assert.ok(week.goal);
  assert.ok(week.skills_covered.length > 0);
  assert.ok(week.tasks.length > 0);
  assert.ok(week.deliverables.length > 0);
  assert.ok(week.suggested_project_work);
  assert.ok(week.resume_bullet_after_completion);
});
