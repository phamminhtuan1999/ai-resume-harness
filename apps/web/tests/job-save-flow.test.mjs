import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLinkState,
  buildSaveRequestFromPreview,
  buildSaveRequestFromSearchResult,
  saveExternalJob,
} from "../src/lib/job-save-flow.mjs";

const API = "https://api.test";
const TOKEN = "session-token";

function jsonResponse(ok, body, { status = ok ? 200 : 502 } = {}) {
  return { ok, status, json: async () => body };
}

const AI_RELEVANCE = {
  is_ai_related: true,
  ai_relevance_score: 84,
  ai_role_category: "applied_ai_engineer",
  transition_friendliness: "high",
  research_heavy: false,
  engineering_focused: true,
  relevance_reason: "Builds LLM products.",
  detected_ai_keywords: ["llm"],
  exclude_reason: null,
};

const QUICK_MATCH = {
  preview_match_score: 72,
  match_label: "possible",
  assistant_preview: "Solid overlap.",
  recommended_action: "apply_with_improvements",
  unavailable: false,
};

function searchJob(overrides = {}) {
  return {
    external_job_id: "adzuna-99",
    external_source: "adzuna",
    title: "Senior Applied AI Engineer",
    company: "Acme AI",
    location: "Remote US",
    salary_range: "$120,000 – $150,000",
    description: "Build LLM products with RAG.",
    apply_url: "https://acme.com/apply/99",
    ai_relevance: AI_RELEVANCE,
    quick_match: QUICK_MATCH,
    ...overrides,
  };
}

function preview(overrides = {}) {
  return {
    title: "AI Engineer",
    company: "Northstar",
    location: "Remote",
    work_type: "remote",
    employment_type: "full-time",
    salary_range: "$180k",
    raw_description: "Ship retrieval features.",
    responsibilities: ["Ship RAG"],
    required_skills: ["Python"],
    preferred_skills: ["LangGraph"],
    required_experience_years: "5+",
    ai_related_requirements: ["LLM eval"],
    cloud_requirements: ["AWS"],
    extraction_confidence: 0.9,
    ai_relevance: AI_RELEVANCE,
    source_url: null,
    normalized_url: null,
    ...overrides,
  };
}

// --- buildSaveRequestFromSearchResult ---

test("search result maps to a discovered_api request with external identity", () => {
  const req = buildSaveRequestFromSearchResult(searchJob());
  assert.equal(req.source, "discovered_api");
  assert.equal(req.title, "Senior Applied AI Engineer");
  assert.equal(req.raw_description, "Build LLM products with RAG.");
  assert.equal(req.external_source, "adzuna");
  assert.equal(req.external_job_id, "adzuna-99");
  assert.equal(req.external_apply_url, "https://acme.com/apply/99");
  assert.equal(req.salary_range, "$120,000 – $150,000");
  assert.deepEqual(req.ai_relevance, AI_RELEVANCE);
  assert.deepEqual(req.quick_match, QUICK_MATCH);
});

test("search result tolerates missing optional fields", () => {
  const req = buildSaveRequestFromSearchResult(
    searchJob({ company: null, location: null, salary_range: null, apply_url: null, quick_match: null })
  );
  assert.equal(req.company, null);
  assert.equal(req.location, null);
  assert.equal(req.salary_range, null);
  assert.equal(req.external_apply_url, null);
  assert.equal(req.quick_match, null);
});

// --- buildSaveRequestFromPreview ---

test("paste preview (no URL) defaults to manual_paste and omits quick match", () => {
  const req = buildSaveRequestFromPreview(preview());
  assert.equal(req.source, "manual_paste");
  assert.equal(req.title, "AI Engineer");
  assert.equal(req.work_type, "remote");
  assert.deepEqual(req.required_skills, ["Python"]);
  assert.deepEqual(req.ai_relevance, AI_RELEVANCE);
  assert.equal("quick_match" in req, false);
});

test("URL preview (normalized_url present) defaults to manual_url", () => {
  const req = buildSaveRequestFromPreview(
    preview({ source_url: "https://acme.com/j/5?utm=li", normalized_url: "https://acme.com/j/5" })
  );
  assert.equal(req.source, "manual_url");
  assert.equal(req.normalized_url, "https://acme.com/j/5");
  assert.equal(req.source_url, "https://acme.com/j/5?utm=li");
});

test("explicit source overrides the provenance default", () => {
  const req = buildSaveRequestFromPreview(preview(), { source: "manual_url" });
  assert.equal(req.source, "manual_url");
});

test("confirm-step overrides win over the extracted preview fields", () => {
  const req = buildSaveRequestFromPreview(preview(), {
    overrides: { title: "Edited Title", company: "Edited Co", raw_description: "Edited body." },
  });
  assert.equal(req.title, "Edited Title");
  assert.equal(req.company, "Edited Co");
  assert.equal(req.raw_description, "Edited body.");
});

test("blank overrides fall through to null company (never invented)", () => {
  const req = buildSaveRequestFromPreview(preview({ company: null }), {
    overrides: { company: "   " },
  });
  assert.equal(req.company, null);
});

// --- applyLinkState ---

test("apply link enabled when a search result has an apply URL", () => {
  assert.deepEqual(applyLinkState(searchJob()), {
    enabled: true,
    url: "https://acme.com/apply/99",
  });
});

test("apply link prefers source_url for a URL-imported preview", () => {
  const state = applyLinkState({ source_url: "https://acme.com/j/5" });
  assert.deepEqual(state, { enabled: true, url: "https://acme.com/j/5" });
});

test("apply link disabled when no URL is present", () => {
  assert.deepEqual(applyLinkState({ apply_url: "   " }), { enabled: false, url: null });
  assert.deepEqual(applyLinkState(null), { enabled: false, url: null });
});

// --- saveExternalJob ---

test("saveExternalJob requires an API base URL", async () => {
  const result = await saveExternalJob({
    apiBaseUrl: "",
    sessionToken: TOKEN,
    request: { source: "manual_paste" },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /not configured/);
});

test("saveExternalJob requires a session token", async () => {
  const result = await saveExternalJob({
    apiBaseUrl: API,
    sessionToken: "",
    request: { source: "manual_paste" },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /authenticate/);
});

test("saveExternalJob rejects an invalid/empty source before calling the API", async () => {
  let called = false;
  const result = await saveExternalJob({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    request: { source: "linkedin_scrape" },
    fetchImpl: async () => {
      called = true;
      return jsonResponse(true, {});
    },
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("saveExternalJob returns the saved job on success", async () => {
  const result = await saveExternalJob({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    request: buildSaveRequestFromSearchResult(searchJob()),
    fetchImpl: async (url, init) => {
      assert.equal(url, `${API}/api/jobs/save-external`);
      assert.equal(init.method, "POST");
      assert.equal(JSON.parse(init.body).source, "discovered_api");
      return jsonResponse(true, { job_id: "job_1", duplicate: false, title: "x" });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.job.job_id, "job_1");
});

test("saveExternalJob surfaces the API detail on failure", async () => {
  const result = await saveExternalJob({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    request: { source: "manual_paste" },
    fetchImpl: async () => jsonResponse(false, { detail: "Job data is unavailable." }, { status: 503 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Job data is unavailable.");
});

test("saveExternalJob handles a network error", async () => {
  const result = await saveExternalJob({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    request: { source: "manual_paste" },
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /could not be reached/);
});
