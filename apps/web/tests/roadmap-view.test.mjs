import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRoadmap, resumeBullets } from "../src/lib/roadmap-view.mjs";

const aiRoadmap = {
  roadmap_summary: "Closes RAG and embeddings gaps.",
  recommended_project_theme: "Multi-document Q&A assistant.",
  weeks: [
    {
      week: 1,
      goal: "Close the RAG gap.",
      skills_covered: ["RAG"],
      tasks: ["Build a demo."],
      deliverables: ["Working demo."],
      project_feature: "Retrieval service.",
      resume_bullet_after_completion: "Built a RAG pipeline.",
      interview_talking_point: "Explain retrieval tradeoffs.",
    },
    { week: 2, goal: "Embeddings.", skills_covered: ["Embeddings"] },
    { week: 3, goal: "Evaluation.", skills_covered: ["Evaluation"] },
    { week: 4, goal: "Deployment.", skills_covered: ["Deployment"] },
  ],
  success_criteria: ["A public demo URL exists."],
  confidence_score: 0.82,
};

test("normalizes the Feature 6.4 AI schema", () => {
  const view = normalizeRoadmap(aiRoadmap);
  assert.equal(view.roadmap_summary, "Closes RAG and embeddings gaps.");
  assert.equal(view.recommended_project_theme, "Multi-document Q&A assistant.");
  assert.equal(view.weeks.length, 4);
  assert.equal(view.weeks[0].project_feature, "Retrieval service.");
  assert.equal(view.weeks[0].interview_talking_point, "Explain retrieval tradeoffs.");
  assert.equal(view.success_criteria.length, 1);
  assert.equal(view.confidence_score, 0.82);
  assert.equal(view.is_legacy, false);
});

test("falls back to legacy US-010 fields", () => {
  const view = normalizeRoadmap({
    target_role: "AI Engineer",
    company: "Acme",
    source: "deterministic-baseline",
    weeks: [
      {
        week: 1,
        goal: "Build RAG evidence.",
        suggested_project_work: "Extend a portfolio project with RAG.",
        priority: "Critical",
      },
    ],
  });
  assert.equal(view.is_legacy, true);
  assert.equal(view.weeks[0].project_feature, "Extend a portfolio project with RAG.");
  assert.equal(view.roadmap_summary, "");
  assert.equal(view.confidence_score, null);
});

test("handles missing or malformed json", () => {
  const view = normalizeRoadmap(null);
  assert.deepEqual(view.weeks, []);
  assert.deepEqual(view.success_criteria, []);
  assert.equal(view.confidence_score, null);
});

test("resumeBullets keeps only weeks with bullets, labeled by week", () => {
  const view = normalizeRoadmap(aiRoadmap);
  const bullets = resumeBullets(view.weeks);
  assert.deepEqual(bullets, [{ week: 1, bullet: "Built a RAG pipeline." }]);
});
