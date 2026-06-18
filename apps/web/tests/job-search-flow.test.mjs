import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  searchAiJobs,
  appendSearchPage,
  groupJobResults,
  aiRelevanceBadge,
  quickMatchBadge,
  recommendedActionLabel,
  transitionFriendlinessBadge,
} from "../src/lib/job-search-flow.mjs";

// --- Helpers ---

function makeJob(overrides = {}) {
  return {
    external_job_id: "job-1",
    external_source: "adzuna",
    title: "AI Engineer",
    company: "Acme",
    location: "Remote US",
    description: "Build AI features.",
    apply_url: "https://example.com/apply",
    pre_score: 80,
    likely_ai_related: true,
    keyword_hits: ["llm", "rag"],
    hidden: false,
    ai_relevance: {
      is_ai_related: true,
      ai_relevance_score: 82,
      ai_role_category: "applied_ai_engineer",
      transition_friendliness: "high",
      research_heavy: false,
      engineering_focused: true,
      relevance_reason: "Uses LLMs and RAG pipelines.",
      detected_ai_keywords: ["llm", "rag"],
      exclude_reason: null,
    },
    quick_match: {
      preview_match_score: 74,
      match_label: "possible",
      assistant_preview: "You cover most requirements.",
      recommended_action: "save",
      unavailable: false,
    },
    ...overrides,
  };
}

function makeSearchResponse(overrides = {}) {
  return {
    search_session_id: "session-abc",
    total_provider_results: 10,
    total_ai_related_results: 3,
    jobs: [makeJob()],
    error: null,
    ...overrides,
  };
}

function makeFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// --- searchAiJobs ---

describe("searchAiJobs", () => {
  it("returns error when apiBaseUrl is missing", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "",
      request: {},
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "not_configured");
  });

  it("returns error when sessionToken is missing", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      request: {},
      sessionToken: "",
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /authenticate/i);
  });

  it("returns error when fetch throws", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: async () => { throw new Error("network"); },
      request: {},
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "search_unavailable");
  });

  it("returns error for non-200 response", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(500, { detail: "Internal error." }),
      request: {},
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.equal(result.message, "Internal error.");
  });

  it("returns error for missing search_session_id in payload", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, { jobs: [] }),
      request: {},
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /invalid data/i);
  });

  it("returns ok:false with error envelope for search_not_configured", async () => {
    const payload = makeSearchResponse({
      total_provider_results: 0,
      total_ai_related_results: 0,
      jobs: [],
      error: { code: "search_not_configured", message: "Job search is not configured." },
    });
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, payload),
      request: {},
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "search_not_configured");
    assert.notEqual(result.result, undefined);
  });

  it("returns ok:true and full result for a valid 200 response", async () => {
    const payload = makeSearchResponse();
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, payload),
      request: { target_role: "AI Engineer", location: "Remote US" },
      sessionToken: "tok",
    });
    assert.equal(result.ok, true);
    assert.equal(result.result?.search_session_id, "session-abc");
    assert.equal(result.result?.total_ai_related_results, 3);
  });

  it("sends the correct Authorization header and JSON body", async () => {
    let capturedUrl;
    let capturedOptions;
    const fetchImpl = async (url, opts) => {
      capturedUrl = url;
      capturedOptions = opts;
      return { ok: true, status: 200, json: async () => makeSearchResponse() };
    };
    await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl,
      request: { target_role: "ML Engineer" },
      sessionToken: "mytoken",
    });
    assert.equal(capturedUrl, "http://api/api/jobs/search-ai");
    assert.equal(capturedOptions.headers["Authorization"], "Bearer mytoken");
    assert.equal(JSON.parse(capturedOptions.body).target_role, "ML Engineer");
  });
});

// --- appendSearchPage (Load more) ---

describe("appendSearchPage", () => {
  const page = (jobs, overrides = {}) => ({
    search_session_id: "s",
    total_provider_results: jobs.length,
    total_ai_related_results: jobs.filter((j) => !j.hidden).length,
    jobs,
    page: 1,
    has_more: false,
    error: null,
    ...overrides,
  });

  it("appends the next page's jobs onto the previous set", () => {
    const prev = page([makeJob({ external_job_id: "a" })], { page: 1, has_more: true });
    const next = page([makeJob({ external_job_id: "b" })], { page: 2, has_more: false });
    const merged = appendSearchPage(prev, next);
    assert.deepEqual(merged.jobs.map((j) => j.external_job_id), ["a", "b"]);
    assert.equal(merged.page, 2);
    assert.equal(merged.has_more, false);
  });

  it("de-duplicates jobs that appear on both pages", () => {
    const prev = page([makeJob({ external_job_id: "a" }), makeJob({ external_job_id: "b" })]);
    const next = page([makeJob({ external_job_id: "b" }), makeJob({ external_job_id: "c" })]);
    const merged = appendSearchPage(prev, next);
    assert.deepEqual(merged.jobs.map((j) => j.external_job_id), ["a", "b", "c"]);
  });

  it("accumulates provider totals and recomputes the visible count", () => {
    const prev = page([
      makeJob({ external_job_id: "a", hidden: false }),
      makeJob({ external_job_id: "h", hidden: true }),
    ]);
    const next = page([makeJob({ external_job_id: "b", hidden: false })]);
    const merged = appendSearchPage(prev, next);
    assert.equal(merged.total_provider_results, 3); // 2 + 1
    assert.equal(merged.total_ai_related_results, 2); // a + b visible, h hidden
  });

  it("carries the new page's has_more so the UI stops at the last page", () => {
    const prev = page([makeJob({ external_job_id: "a" })], { has_more: true });
    const next = page([makeJob({ external_job_id: "b" })], { page: 2, has_more: false });
    assert.equal(appendSearchPage(prev, next).has_more, false);
  });

  it("tolerates missing job arrays", () => {
    const merged = appendSearchPage({}, { jobs: [makeJob({ external_job_id: "a" })], page: 1 });
    assert.deepEqual(merged.jobs.map((j) => j.external_job_id), ["a"]);
  });
});

// --- groupJobResults ---

describe("groupJobResults", () => {
  it("splits visible and hidden jobs", () => {
    const jobs = [
      makeJob({ external_job_id: "v1", hidden: false }),
      makeJob({ external_job_id: "h1", hidden: true }),
      makeJob({ external_job_id: "v2", hidden: false }),
    ];
    const { visible, hidden } = groupJobResults(jobs);
    assert.deepEqual(visible.map((j) => j.external_job_id), ["v1", "v2"]);
    assert.deepEqual(hidden.map((j) => j.external_job_id), ["h1"]);
  });

  it("returns empty arrays when no jobs", () => {
    const { visible, hidden } = groupJobResults([]);
    assert.equal(visible.length, 0);
    assert.equal(hidden.length, 0);
  });

  it("returns all in visible when none are hidden", () => {
    const jobs = [makeJob({ hidden: false }), makeJob({ external_job_id: "j2", hidden: false })];
    const { visible, hidden } = groupJobResults(jobs);
    assert.equal(visible.length, 2);
    assert.equal(hidden.length, 0);
  });
});

// --- aiRelevanceBadge ---

describe("aiRelevanceBadge", () => {
  it("returns success/strong for score ≥75", () => {
    const badge = aiRelevanceBadge({ ai_relevance_score: 80 });
    assert.equal(badge.variant, "success");
    assert.match(badge.label, /strong/i);
  });

  it("returns info/possible for score 60–74", () => {
    const badge = aiRelevanceBadge({ ai_relevance_score: 65 });
    assert.equal(badge.variant, "info");
    assert.match(badge.label, /adjacent/i);
  });

  it("returns outline/hidden for score <60", () => {
    const badge = aiRelevanceBadge({ ai_relevance_score: 40 });
    assert.equal(badge.variant, "outline");
  });

  it("returns outline/unknown for null input", () => {
    const badge = aiRelevanceBadge(null);
    assert.equal(badge.variant, "outline");
    assert.equal(badge.label, "Unknown");
  });
});

// --- quickMatchBadge ---

describe("quickMatchBadge", () => {
  it("returns success for strong match", () => {
    const badge = quickMatchBadge({ match_label: "strong", preview_match_score: 88, unavailable: false });
    assert.equal(badge.variant, "success");
    assert.match(badge.label, /88%/);
  });

  it("returns info for possible match", () => {
    const badge = quickMatchBadge({ match_label: "possible", preview_match_score: 65, unavailable: false });
    assert.equal(badge.variant, "info");
  });

  it("returns warning for weak match", () => {
    const badge = quickMatchBadge({ match_label: "weak", preview_match_score: 42, unavailable: false });
    assert.equal(badge.variant, "warning");
  });

  it("returns outline/preview-unavailable when unavailable:true", () => {
    const badge = quickMatchBadge({ match_label: "strong", preview_match_score: 90, unavailable: true });
    assert.equal(badge.variant, "outline");
    assert.match(badge.label, /unavailable/i);
  });

  it("returns outline/preview-unavailable for null quick_match", () => {
    const badge = quickMatchBadge(null);
    assert.equal(badge.variant, "outline");
    assert.match(badge.label, /unavailable/i);
  });
});

// --- recommendedActionLabel ---

describe("recommendedActionLabel", () => {
  it("maps save_and_analyze", () => {
    assert.equal(recommendedActionLabel("save_and_analyze"), "Save & Analyze");
  });

  it("maps save", () => {
    assert.equal(recommendedActionLabel("save"), "Save");
  });

  it("maps review_carefully", () => {
    assert.equal(recommendedActionLabel("review_carefully"), "Review carefully");
  });

  it("maps skip", () => {
    assert.equal(recommendedActionLabel("skip"), "Skip");
  });

  it("falls back for unknown action", () => {
    assert.equal(recommendedActionLabel("something_else"), "Review");
  });
});

// --- transitionFriendlinessBadge ---

describe("transitionFriendlinessBadge", () => {
  it("returns success for high", () => {
    const badge = transitionFriendlinessBadge("high");
    assert.equal(badge.variant, "success");
    assert.match(badge.label, /transition-friendly/i);
  });

  it("returns info for medium", () => {
    const badge = transitionFriendlinessBadge("medium");
    assert.equal(badge.variant, "info");
  });

  it("returns outline for low", () => {
    const badge = transitionFriendlinessBadge("low");
    assert.equal(badge.variant, "outline");
  });
});
