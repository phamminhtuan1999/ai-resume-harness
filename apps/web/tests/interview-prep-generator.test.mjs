import assert from "node:assert/strict";
import test from "node:test";

import { buildInterviewPrep } from "../src/lib/interview-prep-generator.mjs";

const job = {
  company: "Harness Seed AI",
  title: "Applied AI Engineer",
};

const resume = {
  raw_text: "Built TypeScript services, SQL APIs, deployment automation, and evaluation checks.",
};

const match = {
  strengths_json: [
    { skill: "TypeScript", evidence: "Built TypeScript services." },
    { skill: "SQL", evidence: "Designed SQL APIs." },
  ],
  weaknesses_json: [{ skill: "LLM evaluation", reason: "Limited explicit evaluation depth." }],
  missing_skills_json: [
    { skill: "RAG evaluation", severity: "Critical", reason: "Required by the job." },
    { skill: "Prompt observability", severity: "Medium", reason: "Mentioned in posting." },
  ],
  risks_json: [{ risk: "AI depth", mitigation: "Prepare concrete project proof." }],
};

test("interview prep returns expected question categories", () => {
  const prep = buildInterviewPrep({ job, match, resume });

  assert.ok(Array.isArray(prep.questions_json.technical));
  assert.ok(Array.isArray(prep.questions_json.ai_llm));
  assert.ok(Array.isArray(prep.questions_json.system_design));
  assert.ok(Array.isArray(prep.questions_json.behavioral));
  assert.equal(prep.questions_json.technical.length, 2);
});

test("interview prep turns missing skills into study and proof guidance", () => {
  const prep = buildInterviewPrep({ job, match, resume });

  assert.equal(prep.weak_topics_json[0].topic, "RAG evaluation");
  assert.match(prep.weak_topics_json[0].proof_to_build, /build proof/i);
  assert.match(prep.answer_guidance_json.topics_to_be_careful_with[0].guidance, /unless the resume already contains specific evidence/i);
});

test("interview prep includes answer guidance and a study plan", () => {
  const prep = buildInterviewPrep({ job, match, resume });

  assert.equal(prep.answer_guidance_json.source, "deterministic-baseline");
  assert.ok(prep.answer_guidance_json.opening_pitch.includes("Applied AI Engineer"));
  assert.equal(prep.study_plan_json.length, 3);
  assert.ok(prep.study_plan_json[1].tasks.length >= 2);
});
