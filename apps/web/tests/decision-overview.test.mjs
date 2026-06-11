import assert from "node:assert/strict";
import test from "node:test";

import {
  DEBUG_TERMS,
  DECISION_META,
  RISK_META,
  decisionDelta,
  decisionDisplay,
  decisionMeta,
  evidenceStatusLabel,
  formatVerdictLine,
  isLiveApplication,
  liveApplicationKind,
  pathForward,
  profilePromptFromReasons,
} from "../src/lib/analysis-package-view.mjs";

const ALL_LABELS = [
  "strong_apply",
  "apply_with_improvements",
  "learning_target",
  "not_recommended",
];

const ALL_CONFIDENCE_CODES = [
  "profile_incomplete",
  "no_target_role",
  "job_description_short",
  "job_not_extracted",
  "requirements_ambiguous",
  "deterministic_fallback",
  "module_failed",
  "module_output_partial",
  "module_missing",
];

test("every label maps to a display string and a badge variant", () => {
  for (const label of ALL_LABELS) {
    const meta = decisionMeta(label);
    assert.ok(meta, `missing meta for ${label}`);
    assert.ok(meta.display.length > 0);
    assert.ok(meta.variant.length > 0);
    assert.equal(decisionDisplay(label), meta.display);
  }
  assert.equal(decisionMeta("bogus"), null);
});

test("display copy is the Period 11 wording", () => {
  assert.equal(DECISION_META.strong_apply.display, "Strong Apply Target");
  assert.equal(DECISION_META.apply_with_improvements.display, "Apply With Improvements");
  assert.equal(DECISION_META.learning_target.display, "Learning Target");
  assert.equal(DECISION_META.not_recommended.display, "Not Recommended Yet");
});

test("the verdict line carries exactly one percentage and the risk label", () => {
  const line = formatVerdictLine(27, "high");
  assert.equal(line, "27% match · High risk");
  assert.equal((line.match(/%/g) || []).length, 1, "confidence must not be a second percentage");
});

test("verdict line rounds the score and tolerates a missing risk", () => {
  assert.equal(formatVerdictLine(82.4, "low"), "82% match · Low risk");
  assert.equal(formatVerdictLine(0, "medium"), "0% match · Medium risk");
  assert.equal(formatVerdictLine(50, "bogus"), "50% match");
});

test("the delta renders only when the previous label differs", () => {
  assert.equal(decisionDelta(null, "strong_apply"), null);
  assert.equal(decisionDelta("strong_apply", "strong_apply"), null);

  const up = decisionDelta("not_recommended", "apply_with_improvements");
  assert.deepEqual(up, { direction: "Up", fromDisplay: "Not Recommended Yet" });

  const down = decisionDelta("strong_apply", "learning_target");
  assert.equal(down.direction, "Down");
});

test("only applied/interviewing/offer count as a live application", () => {
  for (const status of ["applied", "interviewing", "offer"]) {
    assert.equal(isLiveApplication(status), true);
    assert.equal(liveApplicationKind(status), status);
  }
  for (const status of ["saved", "rejected", "archived", null, undefined]) {
    assert.equal(isLiveApplication(status), false);
    assert.equal(liveApplicationKind(status), null);
  }
});

test("profile prompts derive from the confidence reason codes", () => {
  assert.deepEqual(profilePromptFromReasons([]), {
    showProfileLink: false,
    showTargetRolePrompt: false,
    showCompletenessWarning: false,
  });
  // US-053: profile_incomplete also raises the explicit completeness warning.
  assert.deepEqual(profilePromptFromReasons(["profile_incomplete"]), {
    showProfileLink: true,
    showTargetRolePrompt: false,
    showCompletenessWarning: true,
  });
  assert.deepEqual(profilePromptFromReasons(["no_target_role"]), {
    showProfileLink: true,
    showTargetRolePrompt: true,
    showCompletenessWarning: false,
  });
  assert.deepEqual(profilePromptFromReasons(["job_description_short"]), {
    showProfileLink: false,
    showTargetRolePrompt: false,
    showCompletenessWarning: false,
  });
});

test("every confidence code is handled without throwing", () => {
  for (const code of ALL_CONFIDENCE_CODES) {
    const result = profilePromptFromReasons([code]);
    assert.equal(typeof result.showProfileLink, "boolean");
    assert.equal(typeof result.showTargetRolePrompt, "boolean");
    assert.equal(typeof result.showCompletenessWarning, "boolean");
  }
});

test("evidence status distinguishes missing from weak from shown", () => {
  assert.equal(evidenceStatusLabel("no_evidence"), "Missing");
  assert.equal(evidenceStatusLabel("weak_evidence"), "Needs confirmation");
  assert.equal(evidenceStatusLabel("strong_evidence"), "Shown");
  assert.equal(evidenceStatusLabel(undefined), "Missing");
});

test("not_recommended always names the concrete path forward", () => {
  const named = pathForward("not_recommended", ["RAG", "Embeddings", "Kafka"]);
  assert.match(named, /RAG and Embeddings/);
  assert.match(named, /profile/i);

  const noSkills = pathForward("not_recommended", []);
  assert.match(noSkills, /profile/i);

  assert.equal(pathForward("strong_apply", ["RAG"]), null);
  assert.equal(pathForward("learning_target", ["RAG"]), null);
});

test("frontend-authored copy carries no model/debug vocabulary", () => {
  const copy = [
    ...ALL_LABELS.map((l) => DECISION_META[l].display),
    ...Object.values(RISK_META).map((r) => r.label),
    pathForward("not_recommended", ["RAG", "Embeddings"]),
    pathForward("not_recommended", []),
    formatVerdictLine(27, "high"),
  ]
    .join(" ")
    .toLowerCase();

  for (const term of DEBUG_TERMS) {
    assert.ok(!copy.includes(term), `debug term leaked into copy: ${term}`);
  }
});
