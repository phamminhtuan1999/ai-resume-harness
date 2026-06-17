import { describe, it, expect } from "vitest";

import {
  searchAiJobs,
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
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });

  it("returns error when sessionToken is missing", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      request: {},
      sessionToken: "",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authenticate/i);
  });

  it("returns error when fetch throws", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: async () => { throw new Error("network"); },
      request: {},
      sessionToken: "tok",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("search_unavailable");
  });

  it("returns error for non-200 response", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(500, { detail: "Internal error." }),
      request: {},
      sessionToken: "tok",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Internal error.");
  });

  it("returns error for missing search_session_id in payload", async () => {
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, { jobs: [] }),
      request: {},
      sessionToken: "tok",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/invalid data/i);
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
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("search_not_configured");
    expect(result.result).toBeDefined();
  });

  it("returns ok:true and full result for a valid 200 response", async () => {
    const payload = makeSearchResponse();
    const result = await searchAiJobs({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, payload),
      request: { target_role: "AI Engineer", location: "Remote US" },
      sessionToken: "tok",
    });
    expect(result.ok).toBe(true);
    expect(result.result?.search_session_id).toBe("session-abc");
    expect(result.result?.total_ai_related_results).toBe(3);
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
    expect(capturedUrl).toBe("http://api/api/jobs/search-ai");
    expect(capturedOptions.headers["Authorization"]).toBe("Bearer mytoken");
    expect(JSON.parse(capturedOptions.body).target_role).toBe("ML Engineer");
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
    expect(visible.map((j) => j.external_job_id)).toEqual(["v1", "v2"]);
    expect(hidden.map((j) => j.external_job_id)).toEqual(["h1"]);
  });

  it("returns empty arrays when no jobs", () => {
    const { visible, hidden } = groupJobResults([]);
    expect(visible).toHaveLength(0);
    expect(hidden).toHaveLength(0);
  });

  it("returns all in visible when none are hidden", () => {
    const jobs = [makeJob({ hidden: false }), makeJob({ external_job_id: "j2", hidden: false })];
    const { visible, hidden } = groupJobResults(jobs);
    expect(visible).toHaveLength(2);
    expect(hidden).toHaveLength(0);
  });
});

// --- aiRelevanceBadge ---

describe("aiRelevanceBadge", () => {
  it("returns success/strong for score ≥75", () => {
    const badge = aiRelevanceBadge({ ai_relevance_score: 80 });
    expect(badge.variant).toBe("success");
    expect(badge.label).toMatch(/strong/i);
  });

  it("returns info/possible for score 60–74", () => {
    const badge = aiRelevanceBadge({ ai_relevance_score: 65 });
    expect(badge.variant).toBe("info");
    expect(badge.label).toMatch(/adjacent/i);
  });

  it("returns outline/hidden for score <60", () => {
    const badge = aiRelevanceBadge({ ai_relevance_score: 40 });
    expect(badge.variant).toBe("outline");
  });

  it("returns outline/unknown for null input", () => {
    const badge = aiRelevanceBadge(null);
    expect(badge.variant).toBe("outline");
    expect(badge.label).toBe("Unknown");
  });
});

// --- quickMatchBadge ---

describe("quickMatchBadge", () => {
  it("returns success for strong match", () => {
    const badge = quickMatchBadge({ match_label: "strong", preview_match_score: 88, unavailable: false });
    expect(badge.variant).toBe("success");
    expect(badge.label).toMatch(/88%/);
  });

  it("returns info for possible match", () => {
    const badge = quickMatchBadge({ match_label: "possible", preview_match_score: 65, unavailable: false });
    expect(badge.variant).toBe("info");
  });

  it("returns warning for weak match", () => {
    const badge = quickMatchBadge({ match_label: "weak", preview_match_score: 42, unavailable: false });
    expect(badge.variant).toBe("warning");
  });

  it("returns outline/preview-unavailable when unavailable:true", () => {
    const badge = quickMatchBadge({ match_label: "strong", preview_match_score: 90, unavailable: true });
    expect(badge.variant).toBe("outline");
    expect(badge.label).toMatch(/unavailable/i);
  });

  it("returns outline/preview-unavailable for null quick_match", () => {
    const badge = quickMatchBadge(null);
    expect(badge.variant).toBe("outline");
    expect(badge.label).toMatch(/unavailable/i);
  });
});

// --- recommendedActionLabel ---

describe("recommendedActionLabel", () => {
  it("maps save_and_analyze", () => {
    expect(recommendedActionLabel("save_and_analyze")).toBe("Save & Analyze");
  });

  it("maps save", () => {
    expect(recommendedActionLabel("save")).toBe("Save");
  });

  it("maps review_carefully", () => {
    expect(recommendedActionLabel("review_carefully")).toBe("Review carefully");
  });

  it("maps skip", () => {
    expect(recommendedActionLabel("skip")).toBe("Skip");
  });

  it("falls back for unknown action", () => {
    expect(recommendedActionLabel("something_else")).toBe("Review");
  });
});

// --- transitionFriendlinessBadge ---

describe("transitionFriendlinessBadge", () => {
  it("returns success for high", () => {
    const badge = transitionFriendlinessBadge("high");
    expect(badge.variant).toBe("success");
    expect(badge.label).toMatch(/transition-friendly/i);
  });

  it("returns info for medium", () => {
    const badge = transitionFriendlinessBadge("medium");
    expect(badge.variant).toBe("info");
  });

  it("returns outline for low", () => {
    const badge = transitionFriendlinessBadge("low");
    expect(badge.variant).toBe("outline");
  });
});
