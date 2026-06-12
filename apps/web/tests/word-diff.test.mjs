import assert from "node:assert/strict";
import test from "node:test";

import { hasWordDiff, wordDiff } from "../src/lib/word-diff.mjs";

test("wordDiff marks an insertion", () => {
  assert.deepEqual(wordDiff("Built APIs", "Built scalable APIs"), [
    { type: "same", text: "Built" },
    { type: "added", text: "scalable" },
    { type: "same", text: "APIs" },
  ]);
});

test("wordDiff marks a deletion", () => {
  assert.deepEqual(wordDiff("Built very fast APIs", "Built fast APIs"), [
    { type: "same", text: "Built" },
    { type: "removed", text: "very" },
    { type: "same", text: "fast APIs" },
  ]);
});

test("wordDiff marks a replacement and merges runs", () => {
  const segments = wordDiff("Led the team daily", "Coached the team weekly");
  assert.deepEqual(segments, [
    { type: "removed", text: "Led" },
    { type: "added", text: "Coached" },
    { type: "same", text: "the team" },
    { type: "removed", text: "daily" },
    { type: "added", text: "weekly" },
  ]);
});

test("wordDiff handles empty sides", () => {
  assert.deepEqual(wordDiff("", "New text"), [{ type: "added", text: "New text" }]);
  assert.deepEqual(wordDiff("Old text", ""), [{ type: "removed", text: "Old text" }]);
  assert.deepEqual(wordDiff("", ""), []);
});

test("wordDiff preserves unicode words", () => {
  const segments = wordDiff("Đã xây dựng API", "Đã thiết kế API");
  assert.deepEqual(segments, [
    { type: "same", text: "Đã" },
    { type: "removed", text: "xây dựng" },
    { type: "added", text: "thiết kế" },
    { type: "same", text: "API" },
  ]);
});

test("hasWordDiff ignores whitespace-only differences", () => {
  assert.equal(hasWordDiff(wordDiff("Built  APIs", "Built APIs")), false);
  assert.equal(hasWordDiff(wordDiff("Built APIs", "Built APIs fast")), true);
});
