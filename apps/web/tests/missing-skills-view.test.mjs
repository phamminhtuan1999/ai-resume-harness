import assert from "node:assert/strict";
import test from "node:test";

import {
  IMPORTANCE_SECTIONS,
  groupByImportance,
  normalizeMissingSkill,
} from "../src/lib/missing-skills-view.mjs";

test("groupByImportance buckets skills into the three sections in order", () => {
  const groups = groupByImportance([
    { skill: "RAG", importance: "critical", gap_type: "true_gap" },
    { skill: "Kafka", importance: "nice_to_have", gap_type: "wording_gap" },
    { skill: "Evaluation", importance: "medium", gap_type: "proof_gap" },
    { skill: "Embeddings", importance: "critical", gap_type: "true_gap" },
  ]);

  assert.deepEqual(
    groups.map((g) => g.key),
    IMPORTANCE_SECTIONS.map((s) => s.key)
  );
  assert.deepEqual(
    groups[0].items.map((i) => i.skill),
    ["RAG", "Embeddings"]
  );
  assert.deepEqual(groups[1].items.map((i) => i.skill), ["Evaluation"]);
  assert.deepEqual(groups[2].items.map((i) => i.skill), ["Kafka"]);
});

test("groupByImportance drops items without a skill and tolerates junk", () => {
  const groups = groupByImportance([{ skill: "" }, null, "nope", { skill: "RAG" }]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  assert.equal(total, 1);
});

test("normalizeMissingSkill defaults unknown enums to safe values", () => {
  const item = normalizeMissingSkill({
    skill: "  RAG  ",
    importance: "bogus",
    gap_type: "bogus",
    evidence_status: "bogus",
  });
  assert.equal(item.skill, "RAG");
  assert.equal(item.importance, "medium");
  assert.equal(item.gap_type, "true_gap");
  assert.equal(item.evidence_status, "no_evidence");
});

test("groupByImportance returns empty buckets for non-array input", () => {
  const groups = groupByImportance(null);
  assert.equal(groups.length, 3);
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), 0);
});
