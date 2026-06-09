import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCKED_ERROR_CODE,
  STEP_MANIFEST,
  anyStepRunning,
  buildPanelRows,
  deriveStepSummary,
  panelProgress,
  remainingActionableSteps,
  stepStatusMeta,
} from "../src/lib/ai-workflow-panel.mjs";
import { runFullWorkflow } from "../src/lib/ai-workflow-client.mjs";

function fakeFetch(status, payload) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

test("manifest lists the ten steps in panel order", () => {
  assert.equal(STEP_MANIFEST.length, 10);
  assert.deepEqual(
    STEP_MANIFEST.map((step) => step.workflow_type),
    [
      "resume_profile_extraction",
      "job_import",
      "job_requirement_extraction",
      "match_analysis",
      "missing_skills",
      "resume_suggestions",
      "cover_letter",
      "roadmap",
      "interview_prep",
      "assistant_insight",
    ]
  );
});

test("deriveStepSummary covers every workflow type with fixture snapshots", () => {
  assert.match(
    deriveStepSummary("match_analysis", { overall_score: 76 }),
    /Overall match is 76%/
  );
  assert.equal(
    deriveStepSummary("match_analysis", { assistant_summary: "Strong fit." }),
    "Strong fit."
  );
  assert.match(
    deriveStepSummary("missing_skills", {
      missing_skills: [{ skill: "RAG" }, { skill: "Eval" }],
      top_3_priority_gaps: ["RAG"],
    }),
    /2 skill gap\(s\) identified\. Top gap: RAG\./
  );
  assert.match(
    deriveStepSummary("resume_suggestions", {
      suggestions: [
        { truth_guard_status: "safe_to_use" },
        { truth_guard_status: "needs_confirmation" },
        { truth_guard_status: "do_not_use_yet" },
      ],
    }),
    /3 suggestion\(s\): 1 safe to use, 1 need confirmation, 1 should not be used yet/
  );
  assert.match(
    deriveStepSummary("cover_letter", { cover_letter: "one two three four" }),
    /4-word cover letter/
  );
  assert.match(
    deriveStepSummary("roadmap", {
      weeks: [{ tasks: ["a", "b"] }, { tasks: ["c"] }, { tasks: [] }, { tasks: ["d"] }],
    }),
    /4-week roadmap generated with 4 task\(s\)/
  );
  assert.match(
    deriveStepSummary("interview_prep", {
      technical_questions: ["q1", "q2"],
      ai_llm_questions: ["q3"],
      system_design_questions: ["q4"],
      behavioral_questions: ["q5"],
      weak_topics_to_study: ["RAG"],
    }),
    /5 interview question\(s\) generated with 1 weak topic\(s\)/
  );
  assert.equal(
    deriveStepSummary("assistant_insight", { assistant_summary: "Tailor first." }),
    "Tailor first."
  );
  assert.ok(deriveStepSummary("resume_profile_extraction", {}));
  assert.ok(deriveStepSummary("job_import", {}));
  assert.ok(deriveStepSummary("job_requirement_extraction", {}));
});

test("buildPanelRows derives pre-match rows and maps run statuses", () => {
  const rows = buildPanelRows({
    runs: [
      {
        workflow_type: "match_analysis",
        status: "completed",
        model_name: "gemini-2.5-flash",
        confidence_score: 0.82,
        completed_at: "2026-06-08T09:01:30Z",
        output_snapshot_json: { overall_score: 76 },
      },
      // Newest-first input: the later row for the same type is ignored.
      { workflow_type: "match_analysis", status: "failed" },
      {
        workflow_type: "roadmap",
        status: "failed",
        error_code: BLOCKED_ERROR_CODE,
        error_message: "Blocked — a previous step failed.",
      },
      { workflow_type: "cover_letter", status: "running" },
      { workflow_type: "missing_skills", status: "failed", error_message: "Rate limited." },
    ],
    profileReady: true,
    jobImported: true,
    jobParsed: false,
  });

  const byType = Object.fromEntries(rows.map((row) => [row.workflow_type, row]));
  assert.equal(byType.resume_profile_extraction.status, "completed");
  assert.equal(byType.job_import.status, "completed");
  assert.equal(byType.job_requirement_extraction.status, "not_started");
  assert.equal(byType.match_analysis.status, "completed");
  assert.match(byType.match_analysis.summary, /Overall match is 76%/);
  assert.equal(byType.roadmap.status, "blocked");
  assert.equal(byType.roadmap.summary, "Skipped — a previous step failed.");
  assert.equal(byType.cover_letter.status, "running");
  assert.equal(byType.missing_skills.status, "failed");
  assert.equal(byType.missing_skills.summary, "Rate limited.");
  assert.equal(byType.interview_prep.status, "not_started");
  assert.equal(anyStepRunning(rows), true);
});

test("panel progress counts completed and needs_review steps", () => {
  const rows = buildPanelRows({
    runs: [
      { workflow_type: "match_analysis", status: "completed" },
      { workflow_type: "missing_skills", status: "needs_review" },
      { workflow_type: "cover_letter", status: "failed" },
    ],
    profileReady: true,
    jobImported: true,
    jobParsed: true,
  });

  // 3 pre-match derived (all ready) + match_analysis + missing_skills = 5 of 10.
  assert.deepEqual(panelProgress(rows), { completed: 5, total: 10, percent: 50 });
  // 7 orchestrated steps minus the 2 already done; failed counts as remaining.
  assert.equal(remainingActionableSteps(rows), 5);
});

test("remaining steps hit zero when every orchestrated step is done", () => {
  const runs = [
    "match_analysis",
    "missing_skills",
    "resume_suggestions",
    "cover_letter",
    "roadmap",
    "interview_prep",
    "assistant_insight",
  ].map((workflow_type) => ({ workflow_type, status: "completed" }));
  const rows = buildPanelRows({
    runs,
    profileReady: true,
    jobImported: true,
    jobParsed: true,
  });
  assert.equal(remainingActionableSteps(rows), 0);
  assert.deepEqual(panelProgress(rows), { completed: 10, total: 10, percent: 100 });
});

test("status badges map to design-system variants", () => {
  assert.equal(stepStatusMeta("completed").variant, "success");
  assert.equal(stepStatusMeta("needs_review").variant, "warning");
  assert.equal(stepStatusMeta("failed").variant, "destructive");
  assert.equal(stepStatusMeta("blocked").label, "Skipped");
  assert.equal(stepStatusMeta("unknown").label, "Not started");
});

test("runFullWorkflow parses complete and partial envelopes", async () => {
  const complete = await runFullWorkflow({
    apiBaseUrl: "http://api",
    matchId: "match_1",
    sessionToken: "token",
    fetchImpl: fakeFetch(200, {
      status: "complete",
      application_status: "prepared",
      steps_completed: 7,
      steps_failed: 0,
      steps_blocked: 0,
    }),
  });
  assert.equal(complete.ok, true);
  assert.equal(complete.applicationStatus, "prepared");
  assert.equal(complete.stepsCompleted, 7);

  const partial = await runFullWorkflow({
    apiBaseUrl: "http://api",
    matchId: "match_1",
    sessionToken: "token",
    fetchImpl: fakeFetch(200, {
      status: "partial",
      steps_completed: 2,
      steps_failed: 1,
      steps_blocked: 4,
      failed_step: "match_analysis",
      error: { code: "provider_rate_limit", message: "Busy.", retryable: true },
    }),
  });
  assert.equal(partial.ok, true);
  assert.equal(partial.status, "partial");
  assert.equal(partial.failedStep, "match_analysis");

  const denied = await runFullWorkflow({
    apiBaseUrl: "http://api",
    matchId: "match_1",
    sessionToken: "token",
    fetchImpl: fakeFetch(403, {
      error: { code: "unauthorized", message: "Not yours.", retryable: false },
    }),
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.message, "Not yours.");
});
