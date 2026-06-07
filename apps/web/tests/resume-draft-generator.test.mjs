import assert from "node:assert/strict";
import test from "node:test";

import { buildTailoredResumeDraft } from "../src/lib/resume-draft-generator.mjs";

test("resume draft generator excludes Do not use yet suggestions", () => {
  const draft = buildTailoredResumeDraft({
    resume: {
      title: "Primary resume",
      raw_text: "Backend engineer with Python and API experience.",
    },
    job: {
      company: "Northstar AI",
      title: "Applied AI Engineer",
    },
    suggestions: [
      {
        truth_guard_status: "Safe to use",
        suggested_text: "Clarify Python API impact with supported production context.",
      },
      {
        truth_guard_status: "Do not use yet",
        suggested_text: "Do not claim RAG yet.",
      },
    ],
  });

  assert.match(draft.content_markdown, /Clarify Python API impact/);
  assert.doesNotMatch(draft.content_markdown, /Do not claim RAG yet/);
  assert.equal(draft.included_suggestion_count, 1);
  assert.equal(draft.excluded_suggestion_count, 1);
});

test("resume draft generator labels confirmation suggestions", () => {
  const draft = buildTailoredResumeDraft({
    resume: {
      title: "Primary resume",
      raw_text: "Backend engineer.",
    },
    job: {
      company: "Northstar AI",
      title: "Applied AI Engineer",
    },
    suggestions: [
      {
        truth_guard_status: "Needs confirmation",
        suggested_text: "Review whether existing work supports evaluation claims.",
      },
    ],
  });

  assert.match(draft.content_markdown, /Needs confirmation before use/);
  assert.equal(draft.included_suggestion_count, 1);
});
