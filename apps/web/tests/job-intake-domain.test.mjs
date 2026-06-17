import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_JOB_SOURCE,
  JOB_SOURCES,
  coerceJobSource,
  isJobSource,
} from "../src/lib/job-source.mjs";

import {
  AI_RELEVANCE_LABELS,
  AI_ROLE_CATEGORIES,
  RELEVANCE_THRESHOLD_POSSIBLE,
  RELEVANCE_THRESHOLD_STRONG,
  TRANSITION_FRIENDLINESS_VALUES,
  aiRelevanceLabelFromScore,
  coerceAiRoleCategory,
  coerceTransitionFriendliness,
  isAiRoleCategory,
  isTransitionFriendliness,
} from "../src/lib/ai-relevance.mjs";

import {
  QUICK_MATCH_LABELS,
  coerceQuickMatchLabel,
  isQuickMatchLabel,
} from "../src/lib/quick-match-labels.mjs";

// --- job-source ---

test("JOB_SOURCES contains the three canonical values in the decided order", () => {
  assert.deepEqual(JOB_SOURCES, ["discovered_api", "manual_url", "manual_paste"]);
});

test("DEFAULT_JOB_SOURCE is manual_paste", () => {
  assert.equal(DEFAULT_JOB_SOURCE, "manual_paste");
});

test("isJobSource recognizes all three values and rejects anything else", () => {
  for (const s of JOB_SOURCES) {
    assert.equal(isJobSource(s), true, `expected ${s} to be a valid source`);
  }
  assert.equal(isJobSource("manual"), false, "retired value must be rejected");
  assert.equal(isJobSource(""), false);
  assert.equal(isJobSource(undefined), false);
  assert.equal(isJobSource(null), false);
});

test("coerceJobSource passes known values through and falls back to default", () => {
  assert.equal(coerceJobSource("discovered_api"), "discovered_api");
  assert.equal(coerceJobSource("manual_url"), "manual_url");
  assert.equal(coerceJobSource("manual_paste"), "manual_paste");
  assert.equal(coerceJobSource("manual"), DEFAULT_JOB_SOURCE);
  assert.equal(coerceJobSource(undefined), DEFAULT_JOB_SOURCE);
  assert.equal(coerceJobSource("garbage"), DEFAULT_JOB_SOURCE);
});

// --- ai-relevance ---

test("AI_ROLE_CATEGORIES includes the full spec set (Section 13)", () => {
  const required = [
    "applied_ai_engineer",
    "llm_engineer",
    "generative_ai_engineer",
    "ai_product_engineer",
    "ml_engineer",
    "ml_research",
    "not_ai_engineering",
    "unknown",
  ];
  for (const cat of required) {
    assert.ok(AI_ROLE_CATEGORIES.includes(cat), `missing category: ${cat}`);
  }
});

test("isAiRoleCategory accepts all listed categories and rejects others", () => {
  for (const cat of AI_ROLE_CATEGORIES) {
    assert.equal(isAiRoleCategory(cat), true);
  }
  assert.equal(isAiRoleCategory("data_scientist"), false);
  assert.equal(isAiRoleCategory(""), false);
  assert.equal(isAiRoleCategory(undefined), false);
});

test("coerceAiRoleCategory passes known values and falls back to unknown", () => {
  assert.equal(coerceAiRoleCategory("applied_ai_engineer"), "applied_ai_engineer");
  assert.equal(coerceAiRoleCategory("not_ai_engineering"), "not_ai_engineering");
  assert.equal(coerceAiRoleCategory("data_scientist"), "unknown");
  assert.equal(coerceAiRoleCategory(undefined), "unknown");
});

test("TRANSITION_FRIENDLINESS_VALUES is the three-value set", () => {
  assert.deepEqual(TRANSITION_FRIENDLINESS_VALUES, ["high", "medium", "low"]);
});

test("isTransitionFriendliness / coerceTransitionFriendliness", () => {
  assert.equal(isTransitionFriendliness("high"), true);
  assert.equal(isTransitionFriendliness("medium"), true);
  assert.equal(isTransitionFriendliness("low"), true);
  assert.equal(isTransitionFriendliness("none"), false);
  assert.equal(isTransitionFriendliness(undefined), false);
  assert.equal(coerceTransitionFriendliness("high"), "high");
  assert.equal(coerceTransitionFriendliness("garbage"), "low");
  assert.equal(coerceTransitionFriendliness(undefined), "low");
});

test("AI_RELEVANCE_LABELS are the three display buckets", () => {
  assert.deepEqual(AI_RELEVANCE_LABELS, ["strong", "possible", "hidden"]);
});

test("aiRelevanceLabelFromScore applies the decided thresholds", () => {
  // Strong: ≥75
  assert.equal(aiRelevanceLabelFromScore(100), "strong");
  assert.equal(aiRelevanceLabelFromScore(RELEVANCE_THRESHOLD_STRONG), "strong");
  assert.equal(aiRelevanceLabelFromScore(75), "strong");
  // Possible: 60–74
  assert.equal(aiRelevanceLabelFromScore(RELEVANCE_THRESHOLD_POSSIBLE), "possible");
  assert.equal(aiRelevanceLabelFromScore(60), "possible");
  assert.equal(aiRelevanceLabelFromScore(74), "possible");
  // Hidden: <60
  assert.equal(aiRelevanceLabelFromScore(59), "hidden");
  assert.equal(aiRelevanceLabelFromScore(0), "hidden");
  // Non-numeric / non-finite → hidden
  assert.equal(aiRelevanceLabelFromScore(null), "hidden");
  assert.equal(aiRelevanceLabelFromScore(undefined), "hidden");
  assert.equal(aiRelevanceLabelFromScore(NaN), "hidden");
});

// --- quick-match-labels ---

test("QUICK_MATCH_LABELS are the four spec values (Section 15)", () => {
  assert.deepEqual(QUICK_MATCH_LABELS, ["strong", "possible", "weak", "limited_data"]);
});

test("isQuickMatchLabel accepts all four values and rejects others", () => {
  for (const label of QUICK_MATCH_LABELS) {
    assert.equal(isQuickMatchLabel(label), true);
  }
  assert.equal(isQuickMatchLabel("unknown"), false);
  assert.equal(isQuickMatchLabel(""), false);
  assert.equal(isQuickMatchLabel(undefined), false);
});

test("coerceQuickMatchLabel passes known values and falls back to limited_data", () => {
  assert.equal(coerceQuickMatchLabel("strong"), "strong");
  assert.equal(coerceQuickMatchLabel("possible"), "possible");
  assert.equal(coerceQuickMatchLabel("weak"), "weak");
  assert.equal(coerceQuickMatchLabel("limited_data"), "limited_data");
  assert.equal(coerceQuickMatchLabel("garbage"), "limited_data");
  assert.equal(coerceQuickMatchLabel(undefined), "limited_data");
  assert.equal(coerceQuickMatchLabel(null), "limited_data");
});
