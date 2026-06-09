import assert from "node:assert/strict";
import test from "node:test";

import {
  AIWorkflowError,
  patchResumeSuggestion,
  runMatchAnalysis,
  runMatchSubWorkflow,
  runWorkflow,
} from "../src/lib/ai-workflow-client.mjs";

const API = "https://api.test";
const TOKEN = "session-token";

function jsonResponse(ok, body, { status = ok ? 200 : 502 } = {}) {
  return { ok, status, json: async () => body };
}

const envelope = {
  workflow_run: {
    id: "run_1",
    workflow_type: "match_analysis",
    status: "completed",
    model_provider: "deterministic",
    confidence_score: 0.6,
  },
  result: { overall_score: 62, apply_recommendation: "apply_with_improvements" },
};

test("runWorkflow parses the standard success envelope", async () => {
  const { workflowRun, result } = await runWorkflow({
    apiBaseUrl: API,
    path: "/api/matches/m1/analyze",
    sessionToken: TOKEN,
    fetchImpl: async (url, init) => {
      assert.equal(url, `${API}/api/matches/m1/analyze`);
      assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
      return jsonResponse(true, envelope);
    },
  });

  assert.equal(workflowRun.status, "completed");
  assert.equal(result.overall_score, 62);
});

test("runWorkflow throws a typed error from the error envelope", async () => {
  await assert.rejects(
    () =>
      runWorkflow({
        apiBaseUrl: API,
        path: "/api/matches/m1/analyze",
        sessionToken: TOKEN,
        fetchImpl: async () =>
          jsonResponse(false, {
            error: {
              code: "missing_job_requirements",
              message: "This job has not been parsed yet.",
              retryable: false,
            },
          }),
      }),
    (error) => {
      assert.ok(error instanceof AIWorkflowError);
      assert.equal(error.code, "missing_job_requirements");
      assert.equal(error.retryable, false);
      assert.match(error.message, /not been parsed/);
      return true;
    }
  );
});

test("runWorkflow maps a 5xx without an envelope to a retryable error", async () => {
  await assert.rejects(
    () =>
      runWorkflow({
        apiBaseUrl: API,
        path: "/api/matches/m1/analyze",
        sessionToken: TOKEN,
        fetchImpl: async () => jsonResponse(false, { detail: "boom" }, { status: 503 }),
      }),
    (error) => {
      assert.equal(error.retryable, true);
      return true;
    }
  );
});

test("runWorkflow rejects a malformed success body", async () => {
  await assert.rejects(
    () =>
      runWorkflow({
        apiBaseUrl: API,
        path: "/api/matches/m1/analyze",
        sessionToken: TOKEN,
        fetchImpl: async () => jsonResponse(true, { not: "an envelope" }),
      }),
    (error) => error instanceof AIWorkflowError && error.code === "schema_validation_failure"
  );
});

test("runWorkflow treats a network throw as retryable", async () => {
  await assert.rejects(
    () =>
      runWorkflow({
        apiBaseUrl: API,
        path: "/api/matches/m1/analyze",
        sessionToken: TOKEN,
        fetchImpl: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    (error) => error.code === "network_failure" && error.retryable === true
  );
});

test("runWorkflow requires an API base URL", async () => {
  await assert.rejects(
    () => runWorkflow({ apiBaseUrl: "", path: "/x", sessionToken: TOKEN }),
    (error) => error instanceof AIWorkflowError
  );
});

test("runMatchAnalysis returns the ok-shape on success", async () => {
  const result = await runMatchAnalysis({
    apiBaseUrl: API,
    matchId: "m1",
    sessionToken: TOKEN,
    fetchImpl: async () => jsonResponse(true, envelope),
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.overall_score, 62);
});

test("runMatchAnalysis maps a typed error into the ok-shape", async () => {
  const result = await runMatchAnalysis({
    apiBaseUrl: API,
    matchId: "m1",
    sessionToken: TOKEN,
    fetchImpl: async () =>
      jsonResponse(false, {
        error: { code: "unauthorized", message: "No access.", retryable: false },
      }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "unauthorized");
  assert.equal(result.retryable, false);
});

test("runMatchAnalysis targets the regenerate path", async () => {
  let calledPath = "";
  await runMatchAnalysis({
    apiBaseUrl: API,
    matchId: "m1",
    sessionToken: TOKEN,
    regenerate: true,
    fetchImpl: async (url) => {
      calledPath = url;
      return jsonResponse(true, envelope);
    },
  });

  assert.match(calledPath, /\/analyze\/regenerate$/);
});

test("runMatchSubWorkflow targets the segment path", async () => {
  let calledPath = "";
  const result = await runMatchSubWorkflow({
    apiBaseUrl: API,
    matchId: "m1",
    segment: "missing-skills",
    sessionToken: TOKEN,
    fetchImpl: async (url) => {
      calledPath = url;
      return jsonResponse(true, envelope);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calledPath, `${API}/api/matches/m1/missing-skills`);
});

test("runMatchSubWorkflow targets the segment regenerate path", async () => {
  let calledPath = "";
  await runMatchSubWorkflow({
    apiBaseUrl: API,
    matchId: "m1",
    segment: "assistant-insight",
    sessionToken: TOKEN,
    regenerate: true,
    fetchImpl: async (url) => {
      calledPath = url;
      return jsonResponse(true, envelope);
    },
  });

  assert.match(calledPath, /\/assistant-insight\/regenerate$/);
});

test("runMatchSubWorkflow maps a typed error into the ok-shape", async () => {
  const result = await runMatchSubWorkflow({
    apiBaseUrl: API,
    matchId: "m1",
    segment: "missing-skills",
    sessionToken: TOKEN,
    fetchImpl: async () =>
      jsonResponse(false, {
        error: { code: "missing_match_analysis", message: "Analyze first.", retryable: false },
      }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_match_analysis");
});

test("runMatchSubWorkflow requires a match and a segment", async () => {
  const noMatch = await runMatchSubWorkflow({ apiBaseUrl: API, segment: "x", sessionToken: TOKEN });
  assert.equal(noMatch.ok, false);
  const noSegment = await runMatchSubWorkflow({ apiBaseUrl: API, matchId: "m1", sessionToken: TOKEN });
  assert.equal(noSegment.ok, false);
});

test("patchResumeSuggestion PATCHes the suggestion with the action + edited text", async () => {
  let seen = {};
  const result = await patchResumeSuggestion({
    apiBaseUrl: API,
    suggestionId: "sug_1",
    sessionToken: TOKEN,
    userAction: "accepted",
    suggestedText: "Edited bullet.",
    fetchImpl: async (url, init) => {
      seen = { url, method: init.method, body: JSON.parse(init.body) };
      return jsonResponse(true, { suggestion: { id: "sug_1", user_action: "accepted" } });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.suggestion.user_action, "accepted");
  assert.equal(seen.url, `${API}/api/resume-suggestions/sug_1`);
  assert.equal(seen.method, "PATCH");
  assert.deepEqual(seen.body, { user_action: "accepted", suggested_text: "Edited bullet." });
});

test("patchResumeSuggestion omits suggested_text when not provided", async () => {
  let body = null;
  await patchResumeSuggestion({
    apiBaseUrl: API,
    suggestionId: "sug_1",
    sessionToken: TOKEN,
    userAction: "rejected",
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return jsonResponse(true, { suggestion: { id: "sug_1" } });
    },
  });
  assert.deepEqual(body, { user_action: "rejected" });
});

test("patchResumeSuggestion maps an error envelope to ok:false", async () => {
  const result = await patchResumeSuggestion({
    apiBaseUrl: API,
    suggestionId: "sug_1",
    sessionToken: TOKEN,
    userAction: "accepted",
    fetchImpl: async () =>
      jsonResponse(false, { error: { code: "unauthorized", message: "No access." } }, { status: 403 }),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /No access/);
});

test("patchResumeSuggestion requires a suggestion id", async () => {
  const result = await patchResumeSuggestion({ apiBaseUrl: API, sessionToken: TOKEN, userAction: "accepted" });
  assert.equal(result.ok, false);
});
