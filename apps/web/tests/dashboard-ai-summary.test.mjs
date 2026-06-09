import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  NOT_ENOUGH_DATA_MESSAGE,
  healthLabel,
  healthVariant,
  normalizeDashboardAiSummary,
} from "../src/lib/dashboard-ai-summary.mjs";

test("not-enough-data message matches the §9.6 verbatim copy", () => {
  assert.equal(
    NOT_ENOUGH_DATA_MESSAGE,
    "ApplyWise needs more analyzed jobs before giving a strong pattern-based " +
      "recommendation. Add or import at least 3 jobs to unlock a stronger " +
      "dashboard summary."
  );
});

test("normalizes a persisted dashboard_ai_summary row", () => {
  const view = normalizeDashboardAiSummary({
    dashboard_summary: "You match backend AI roles best.",
    best_fit_roles_json: ["AI Engineer"],
    repeated_skill_gaps_json: ["RAG", "vector databases"],
    job_search_health: "moderate",
    recommended_next_actions_json: ["Build a RAG project."],
    confidence_score: 0.78,
    provider: "gemini",
  });
  assert.equal(view.job_search_health, "moderate");
  assert.deepEqual(view.repeated_skill_gaps, ["RAG", "vector databases"]);
  assert.equal(view.confidence_score, 0.78);
  assert.equal(view.provider, "gemini");
});

test("unknown health values fall back to not_enough_data", () => {
  const view = normalizeDashboardAiSummary({ job_search_health: "amazing" });
  assert.equal(view.job_search_health, "not_enough_data");
  assert.equal(view.confidence_score, null);
});

test("health badges map strong/moderate/weak to design-system variants", () => {
  assert.equal(healthVariant("strong"), "success");
  assert.equal(healthVariant("moderate"), "warning");
  assert.equal(healthVariant("weak"), "destructive");
  assert.equal(healthLabel("not_enough_data"), "Not enough data");
});

test("dashboard page renders the AI summary card", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "app", "(app)", "dashboard", "page.tsx"),
    "utf8"
  );
  assert.match(source, /DashboardAiSummaryCard/);
  assert.match(source, /getDashboardAiSummary/);
});
