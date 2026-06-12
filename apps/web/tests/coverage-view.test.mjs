import assert from "node:assert/strict";
import test from "node:test";

import {
  coverageReport,
  extractJobKeywords,
  renderableCvTexts,
} from "../src/lib/coverage-view.mjs";

test("extractJobKeywords mirrors the API extraction and dedupes", () => {
  const keywords = extractJobKeywords({
    required_skills: ["Python", "FastAPI", " python "],
    preferred_skills: ["AWS"],
    ai_requirements: ["RAG pipelines"],
    cloud_requirements: [],
  });
  assert.deepEqual(keywords, ["Python", "FastAPI", "AWS", "RAG pipelines"]);
  assert.deepEqual(extractJobKeywords(null), []);
  assert.deepEqual(extractJobKeywords("nope"), []);
});

test("coverageReport computes base vs tailored percentages and the delta", () => {
  const report = coverageReport({
    keywords: ["Python", "FastAPI", "AWS", "RAG pipelines"],
    baseText: "Engineer using Python and FastAPI on AWS.",
    tailoredTexts: ["Engineered FastAPI services.", "Python"],
    excludedKeywords: [],
  });
  assert.equal(report.claimableCount, 4);
  assert.equal(report.basePercent, 75); // Python, FastAPI, AWS
  assert.equal(report.tailoredPercent, 50); // Python, FastAPI
  assert.equal(report.delta, -25);
  assert.deepEqual(report.missing, ["AWS", "RAG pipelines"]);
});

test("excluded keywords are not claimable and never count as misses", () => {
  const report = coverageReport({
    keywords: ["Python", "Kubernetes"],
    baseText: "Python only.",
    tailoredTexts: ["Python services."],
    excludedKeywords: ["kubernetes"],
  });
  assert.deepEqual(report.notClaimable, ["Kubernetes"]);
  assert.deepEqual(report.missing, []); // Kubernetes is separated, not a miss
  assert.equal(report.claimableCount, 1);
  assert.equal(report.tailoredPercent, 100); // denominator excludes Kubernetes
});

test("excluded keywords accept {keyword} objects from cv_strategy_json", () => {
  const report = coverageReport({
    keywords: ["Python", "Kubernetes"],
    baseText: "",
    tailoredTexts: [],
    excludedKeywords: [{ keyword: "Kubernetes", reason: "unsupported" }],
  });
  assert.deepEqual(report.notClaimable, ["Kubernetes"]);
});

test("matching is whole-word and case-insensitive", () => {
  const report = coverageReport({
    keywords: ["Go", "C++", "RAG pipelines"],
    baseText: "Google fan.",
    tailoredTexts: ["Built C++ tooling.", "Operated RAG\n  pipelines daily.", "We go far."],
    excludedKeywords: [],
  });
  assert.equal(report.basePercent, 0); // "Google" must not match "Go"
  // C++, multi-word phrase across whitespace, and case-insensitive "go" all hit.
  assert.equal(report.tailoredPercent, 100);
});

test("empty keyword list yields a zeroed report", () => {
  const report = coverageReport({
    keywords: [],
    baseText: "anything",
    tailoredTexts: ["anything"],
    excludedKeywords: [],
  });
  assert.equal(report.claimableCount, 0);
  assert.equal(report.basePercent, 0);
  assert.equal(report.tailoredPercent, 0);
  assert.deepEqual(report.missing, []);
});

test("renderableCvTexts collects summary, skills, and bullet texts", () => {
  const texts = renderableCvTexts({
    professionalSummary: "Summary line.",
    skills: [{ category: "Backend", items: ["FastAPI", "Postgres"] }],
    workExperience: [{ bullets: [{ text: "Did a thing." }] }],
    projects: [{ bullets: ["Legacy string bullet."] }],
  });
  assert.deepEqual(texts, [
    "Summary line.",
    "FastAPI",
    "Postgres",
    "Did a thing.",
    "Legacy string bullet.",
  ]);
  assert.deepEqual(renderableCvTexts(null), []);
});
