import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SAVED_JOB_SORTS,
  savedJobSortLabel,
  resolveSavedJobSort,
  sortSavedJobs,
} from "../src/lib/saved-jobs-view.mjs";

function row(overrides = {}) {
  return {
    id: "j1",
    company: "Acme",
    title: "AI Engineer",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveSavedJobSort", () => {
  it("passes through the known keys", () => {
    for (const key of SAVED_JOB_SORTS) {
      assert.equal(resolveSavedJobSort(key), key);
    }
  });

  it("falls back to 'recent' for unknown or missing values", () => {
    assert.equal(resolveSavedJobSort("nonsense"), "recent");
    assert.equal(resolveSavedJobSort(undefined), "recent");
    assert.equal(resolveSavedJobSort(null), "recent");
  });
});

describe("savedJobSortLabel", () => {
  it("labels each sort key", () => {
    assert.equal(savedJobSortLabel("recent"), "Recently saved");
    assert.equal(savedJobSortLabel("match"), "Best match");
    assert.equal(savedJobSortLabel("company"), "Company");
    assert.equal(savedJobSortLabel("bogus"), "Recently saved");
  });
});

describe("sortSavedJobs", () => {
  it("sorts by created_at descending for 'recent' (the default)", () => {
    const jobs = [
      row({ id: "old", created_at: "2026-01-01T00:00:00.000Z" }),
      row({ id: "new", created_at: "2026-03-01T00:00:00.000Z" }),
      row({ id: "mid", created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    assert.deepEqual(sortSavedJobs(jobs, "recent").map((j) => j.id), ["new", "mid", "old"]);
    // unknown key behaves like 'recent'
    assert.deepEqual(sortSavedJobs(jobs, "???").map((j) => j.id), ["new", "mid", "old"]);
  });

  it("sorts by best match score descending, unscored rows last", () => {
    const jobs = [
      row({ id: "a" }),
      row({ id: "b" }),
      row({ id: "c" }),
    ];
    const scores = { a: 55, b: 88 }; // c has no analyzed match
    assert.deepEqual(sortSavedJobs(jobs, "match", scores).map((j) => j.id), ["b", "a", "c"]);
  });

  it("breaks match ties by company then title", () => {
    const jobs = [
      row({ id: "z", company: "Zeta" }),
      row({ id: "a", company: "Alpha" }),
    ];
    const scores = { z: 70, a: 70 };
    assert.deepEqual(sortSavedJobs(jobs, "match", scores).map((j) => j.id), ["a", "z"]);
  });

  it("sorts alphabetically by company for 'company'", () => {
    const jobs = [
      row({ id: "n", company: "Nimbus" }),
      row({ id: "a", company: "Acme" }),
      row({ id: "m", company: "Meridian" }),
    ];
    assert.deepEqual(sortSavedJobs(jobs, "company").map((j) => j.id), ["a", "m", "n"]);
  });

  it("does not mutate the input array and tolerates non-arrays", () => {
    const jobs = [row({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }), row({ id: "b", created_at: "2026-02-01T00:00:00.000Z" })];
    const snapshot = [...jobs];
    sortSavedJobs(jobs, "recent");
    assert.deepEqual(jobs, snapshot);
    assert.deepEqual(sortSavedJobs(undefined, "recent"), []);
  });
});
