import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFieldValue, valuesDiffer } from "../src/lib/form-dirty.mjs";

test("valuesDiffer is false when nothing changed", () => {
  const base = { current_role: "Engineer", years: "4", target: "AI Engineer" };
  assert.equal(valuesDiffer(base, { ...base }), false);
});

test("valuesDiffer detects a changed field", () => {
  const base = { current_role: "Engineer", target: "AI Engineer" };
  assert.equal(valuesDiffer(base, { ...base, target: "ML Engineer" }), true);
});

test("valuesDiffer treats null, undefined, and blank as equal", () => {
  assert.equal(valuesDiffer({ location: null }, { location: "" }), false);
  assert.equal(valuesDiffer({ location: "  " }, { location: undefined }), false);
});

test("valuesDiffer detects filling a previously empty field", () => {
  assert.equal(valuesDiffer({ location: "" }, { location: "US remote" }), true);
});

test("valuesDiffer trims surrounding whitespace before comparing", () => {
  assert.equal(valuesDiffer({ role: "AI" }, { role: " AI " }), false);
});

test("valuesDiffer supports a single-key status comparison", () => {
  assert.equal(valuesDiffer({ status: "saved" }, { status: "saved" }), false);
  assert.equal(valuesDiffer({ status: "saved" }, { status: "applied" }), true);
});

test("normalizeFieldValue coerces nullish and trims", () => {
  assert.equal(normalizeFieldValue(null), "");
  assert.equal(normalizeFieldValue(undefined), "");
  assert.equal(normalizeFieldValue(4), "4");
  assert.equal(normalizeFieldValue("  hi "), "hi");
});
