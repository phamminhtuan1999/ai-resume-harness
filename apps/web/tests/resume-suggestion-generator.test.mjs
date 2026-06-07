import assert from "node:assert/strict";
import test from "node:test";

import { buildResumeSuggestions } from "../src/lib/resume-suggestion-generator.mjs";

test("resume suggestion generator marks matched evidence safe", () => {
  const suggestions = buildResumeSuggestions({
    match: {
      strengths_json: [{ skill: "python", evidence: "python appears in resume and job." }],
      weaknesses_json: [],
      missing_skills_json: [],
    },
  });

  assert.equal(suggestions[0].truth_guard_status, "Safe to use");
  assert.equal(suggestions[0].related_job_requirement, "python");
  assert.match(suggestions[0].reason, /resume evidence/);
});

test("resume suggestion generator blocks unsupported missing skills", () => {
  const suggestions = buildResumeSuggestions({
    match: {
      strengths_json: [],
      weaknesses_json: [],
      missing_skills_json: [
        {
          skill: "rag",
          why_it_matters: "rag appears in the job description but not the resume.",
        },
      ],
    },
  });

  assert.equal(suggestions[0].truth_guard_status, "Do not use yet");
  assert.equal(suggestions[0].related_job_requirement, "rag");
  assert.match(suggestions[0].suggested_text, /Do not claim rag yet/);
});

test("resume suggestion generator asks for confirmation when evidence is weak", () => {
  const suggestions = buildResumeSuggestions({
    match: {
      strengths_json: [],
      weaknesses_json: [{ skill: "evaluation", reason: "Weakly shown." }],
      missing_skills_json: [],
    },
  });

  assert.equal(suggestions[0].truth_guard_status, "Needs confirmation");
  assert.equal(suggestions[0].suggestion_type, "evidence-review");
});
