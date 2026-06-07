import assert from "node:assert/strict";
import test from "node:test";

import { analyzeResumeJobFit } from "../src/lib/match-analyzer.mjs";

test("match analyzer extracts shared skills and weighted scores", () => {
  const analysis = analyzeResumeJobFit({
    resumeText:
      "Senior Software Engineer with 6 years of Python, FastAPI, SQL, Postgres, testing, and Docker experience.",
    jobDescription:
      "Senior Applied AI Engineer. Requires 5 years, Python, FastAPI, SQL, Postgres, Docker, RAG, embeddings, and evaluation.",
  });

  assert.equal(analysis.explanation_json.analyzer, "deterministic-baseline");
  assert.equal(analysis.structured_resume.years_of_experience, 6);
  assert.equal(analysis.structured_job.years_required, 5);
  assert.ok(analysis.skill_score > 50);
  assert.ok(analysis.overall_score >= 60);
  assert.ok(analysis.strengths_json.some((strength) => strength.skill === "python"));
  assert.ok(analysis.missing_skills_json.some((gap) => gap.skill === "rag"));
});

test("match analyzer does not invent missing skills", () => {
  const analysis = analyzeResumeJobFit({
    resumeText: "Backend engineer with API design and testing experience.",
    jobDescription: "LLM engineer role requiring LangChain, vector database, and embeddings.",
  });

  assert.deepEqual(analysis.structured_resume.skills, ["api design", "testing"]);
  assert.equal(analysis.strengths_json.length, 0);
  assert.equal(analysis.missing_skills_json.length, 4);
  assert.equal(analysis.missing_skills_json[0].gap_type, "True Gap");
});
