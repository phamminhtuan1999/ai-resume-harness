import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInterviewPrep } from "../src/lib/interview-prep-view.mjs";

const aiRow = {
  questions_json: {
    technical_questions: ["How have you used FastAPI in production?"],
    ai_llm_questions: ["Design a RAG pipeline for matching."],
    system_design_questions: ["Design a scalable job-matching service."],
    behavioral_questions: ["Tell me about learning a skill quickly."],
  },
  weak_topics_json: ["vector databases", "embeddings evaluation"],
  study_plan_json: { prep_summary: "Expect deep RAG questions.", study_plan: [] },
  answer_guidance_json: [
    {
      question: "How have you used FastAPI in production?",
      recommended_angle: "Lead with production services.",
      resume_evidence_to_use: "Built FastAPI services for 3 years.",
      warning: null,
    },
    {
      question: "What is your hands-on vector database experience?",
      recommended_angle: "Be honest that proof is limited.",
      resume_evidence_to_use: null,
      warning: "No vector-DB evidence found. Build a prototype first.",
    },
  ],
};

const legacyRow = {
  questions_json: {
    technical: [{ question: "How have you used Python?", category: "technical" }],
    ai_llm: [{ question: "How would you evaluate an AI feature?" }],
    system_design: [{ question: "Design a matching workflow." }],
    behavioral: [{ question: "Tell me about a fast learning experience." }],
  },
  weak_topics_json: [{ topic: "RAG", severity: "Critical" }],
  study_plan_json: [{ phase: "Day 1", focus: "Evidence", tasks: [] }],
  answer_guidance_json: {
    source: "deterministic-baseline",
    opening_pitch: "Position yourself with concrete evidence.",
    topics_to_be_careful_with: [{ topic: "RAG", guidance: "Treat as study topic." }],
  },
};

test("normalizes the Feature 7.4 AI shape", () => {
  const view = normalizeInterviewPrep(aiRow);
  assert.equal(view.is_legacy, false);
  assert.equal(view.prep_summary, "Expect deep RAG questions.");
  assert.deepEqual(view.weak_topics_to_study, ["vector databases", "embeddings evaluation"]);
  assert.equal(view.technical_questions.length, 1);
  assert.equal(view.answer_guidance.length, 2);
  assert.equal(view.answer_guidance[1].resume_evidence_to_use, null);
  assert.ok(view.answer_guidance[1].warning);
});

test("normalizes the legacy US-011 shape", () => {
  const view = normalizeInterviewPrep(legacyRow);
  assert.equal(view.is_legacy, true);
  assert.deepEqual(view.technical_questions, ["How have you used Python?"]);
  assert.deepEqual(view.weak_topics_to_study, ["RAG"]);
  assert.equal(view.prep_summary, "Position yourself with concrete evidence.");
  assert.equal(view.answer_guidance.length, 1);
  assert.equal(view.answer_guidance[0].question, "RAG");
  assert.equal(view.answer_guidance[0].resume_evidence_to_use, null);
  assert.ok(view.answer_guidance[0].warning);
});

test("handles missing rows", () => {
  const view = normalizeInterviewPrep(null);
  assert.equal(view.prep_summary, "");
  assert.deepEqual(view.technical_questions, []);
  assert.deepEqual(view.answer_guidance, []);
});
