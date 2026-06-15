import assert from "node:assert/strict";
import test from "node:test";

import { draftCvToText } from "../src/lib/draft-cv-view.mjs";
import {
  diffByLine,
  diffCharStats,
  diffWordsByLine,
  hasVersionDiff,
} from "../src/lib/version-diff.mjs";

test("diffByLine tags added, removed, and context lines in order", () => {
  const rows = diffByLine("alpha\nbeta\ngamma", "alpha\nBETA\ngamma");
  assert.deepEqual(
    rows.map((r) => [r.type, r.text]),
    [
      ["same", "alpha"],
      ["removed", "beta"],
      ["added", "BETA"],
      ["same", "gamma"],
    ]
  );
});

test("diffByLine on identical text is all context", () => {
  const rows = diffByLine("one\ntwo", "one\ntwo");
  assert.ok(rows.every((r) => r.type === "same"));
});

test("diffWordsByLine keeps one entry per line and marks inline word changes", () => {
  const lines = diffWordsByLine("built with React", "using React and Tailwind");
  assert.equal(lines.length, 1);
  const types = lines[0].map((s) => s.type);
  assert.ok(types.includes("removed")); // "built with"
  assert.ok(types.includes("added")); // "using"/"and Tailwind"
  assert.ok(types.includes("same")); // "React"
});

test("diffWordsByLine preserves line structure across newlines", () => {
  const lines = diffWordsByLine("a\nb\nc", "a\nB\nc");
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], [{ type: "same", text: "a" }]);
  assert.deepEqual(lines[1], [{ type: "removed", text: "b" }, { type: "added", text: "B" }]);
});

test("diffCharStats counts added/removed characters and net", () => {
  // "beta"(removed 4) -> "BETA"(added 4): net 0.
  assert.deepEqual(diffCharStats("beta", "BETA"), { added: 4, removed: 4, net: 0 });
  // pure addition
  assert.deepEqual(diffCharStats("hi", "hi there"), { added: 5, removed: 0, net: 5 });
});

test("hasVersionDiff is false only for word-identical text", () => {
  assert.equal(hasVersionDiff("same words", "same words"), false);
  assert.equal(hasVersionDiff("same words", "same  words"), false); // whitespace-only
  assert.equal(hasVersionDiff("same words", "same word"), true);
});

const sampleCv = {
  candidate: { full_name: "John Doe", email: "john@example.com" },
  professional_summary: "Engineer who ships.",
  skills: [{ category: "Languages", items: ["TypeScript", "Python"] }],
  work_experience: [
    {
      company: "InnovateX",
      title: "Software Engineer",
      start_date: "Jun 2020",
      end_date: "Jan 2022",
      bullets: [
        { text: "Built internal tools", truth_guard_status: "safe_to_use" },
        { text: "Hidden claim", truth_guard_status: "do_not_use_yet" },
      ],
    },
  ],
  projects: [],
  education: [{ school: "State University", degree: "BSc", field: "CS" }],
  certifications: [],
};

test("draftCvToText serializes only renderable content in preview order", () => {
  const text = draftCvToText(sampleCv);
  assert.match(text, /^John Doe/);
  assert.match(text, /john@example\.com/);
  assert.match(text, /Professional Summary\nEngineer who ships\./);
  assert.match(text, /Languages: TypeScript, Python/);
  assert.match(text, /InnovateX — Software Engineer/);
  assert.match(text, /• Built internal tools/);
  assert.match(text, /State University, BSc, CS/);
  // Excluded (non-renderable) bullet must not leak into the diff text.
  assert.doesNotMatch(text, /Hidden claim/);
});

test("draftCvToText output diffs cleanly between two versions", () => {
  const v2 = {
    ...sampleCv,
    work_experience: [
      {
        ...sampleCv.work_experience[0],
        bullets: [
          { text: "Built and shipped internal tools", truth_guard_status: "safe_to_use" },
        ],
      },
    ],
  };
  const stats = diffCharStats(draftCvToText(sampleCv), draftCvToText(v2));
  assert.ok(stats.added > 0);
  assert.equal(hasVersionDiff(draftCvToText(sampleCv), draftCvToText(v2)), true);
});
