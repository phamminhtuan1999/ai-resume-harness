import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_PASTE_CHARS,
  extractJobFromDescription,
  previewJobByUrl,
  validatePasteLength,
  needsConfirmation,
  nonAiWarning,
} from "../src/lib/job-preview-flow.mjs";

function makePreview(overrides = {}) {
  return {
    title: "Applied AI Engineer",
    company: "Acme AI",
    location: "Remote US",
    raw_description: "Build LLM products.",
    needs_confirmation: false,
    relevance_available: true,
    ai_relevance: {
      is_ai_related: true,
      ai_relevance_score: 84,
      ai_role_category: "applied_ai_engineer",
      transition_friendliness: "high",
      research_heavy: false,
      engineering_focused: true,
      relevance_reason: "Builds LLM products.",
      detected_ai_keywords: ["llm"],
      exclude_reason: null,
    },
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

const LONG_DESC = "Applied AI Engineer building RAG and LLM systems on AWS.";

// --- validatePasteLength ---

describe("validatePasteLength", () => {
  it("rejects descriptions shorter than MIN_PASTE_CHARS", () => {
    const result = validatePasteLength("too short");
    assert.equal(result.ok, false);
    assert.match(result.message, /too short/i);
  });

  it("accepts a sufficiently long description", () => {
    assert.equal(validatePasteLength("x".repeat(MIN_PASTE_CHARS)).ok, true);
  });

  it("trims before measuring", () => {
    const padded = "   " + "y".repeat(MIN_PASTE_CHARS - 1) + "   ";
    assert.equal(validatePasteLength(padded).ok, false);
  });
});

// --- needsConfirmation ---

describe("needsConfirmation", () => {
  it("is false when title and company are present", () => {
    assert.equal(needsConfirmation(makePreview()), false);
  });

  it("is true when company is blank", () => {
    assert.equal(needsConfirmation(makePreview({ company: "" })), true);
  });

  it("is true when title is blank", () => {
    assert.equal(needsConfirmation(makePreview({ title: "   " })), true);
  });

  it("is true for a null preview", () => {
    assert.equal(needsConfirmation(null), true);
  });
});

// --- nonAiWarning ---

describe("nonAiWarning", () => {
  it("does not warn for a strong AI role", () => {
    assert.equal(nonAiWarning(makePreview().ai_relevance).warn, false);
  });

  it("does not warn for a possible (60-74) AI role", () => {
    const rel = { is_ai_related: true, ai_relevance_score: 65 };
    assert.equal(nonAiWarning(rel).warn, false);
  });

  it("warns when score is below the possible threshold", () => {
    const rel = {
      is_ai_related: false,
      ai_relevance_score: 30,
      relevance_reason: "This is a generic backend role.",
    };
    const result = nonAiWarning(rel);
    assert.equal(result.warn, true);
    assert.match(result.reason, /generic backend/i);
  });

  it("warns when is_ai_related is false even with a borderline score", () => {
    const rel = { is_ai_related: false, ai_relevance_score: 70 };
    assert.equal(nonAiWarning(rel).warn, true);
  });

  it("does not warn when relevance is unavailable", () => {
    assert.equal(nonAiWarning(makePreview().ai_relevance, false).warn, false);
  });

  it("does not warn for a null relevance", () => {
    assert.equal(nonAiWarning(null).warn, false);
  });
});

// --- extractJobFromDescription ---

describe("extractJobFromDescription", () => {
  it("short-circuits on a too-short description without calling the API", async () => {
    let called = false;
    const result = await extractJobFromDescription({
      apiBaseUrl: "http://api",
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, json: async () => ({}) };
      },
      rawDescription: "short",
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.equal(result.tooShort, true);
    assert.equal(called, false);
  });

  it("returns error when apiBaseUrl is missing", async () => {
    const result = await extractJobFromDescription({
      apiBaseUrl: "",
      rawDescription: LONG_DESC,
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
  });

  it("returns ok with the preview on success", async () => {
    const preview = makePreview();
    const result = await extractJobFromDescription({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, preview),
      rawDescription: LONG_DESC,
      sessionToken: "tok",
    });
    assert.equal(result.ok, true);
    assert.equal(result.preview.title, "Applied AI Engineer");
  });

  it("surfaces the API detail on a 422", async () => {
    const result = await extractJobFromDescription({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(422, { detail: "This job description is too short." }),
      rawDescription: LONG_DESC,
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /too short/i);
  });

  it("sends title and company in the request body", async () => {
    let sentBody;
    const fetchImpl = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => makePreview() };
    };
    await extractJobFromDescription({
      apiBaseUrl: "http://api",
      fetchImpl,
      rawDescription: LONG_DESC,
      title: "My Title",
      company: "My Co",
      sessionToken: "tok",
    });
    assert.equal(sentBody.title, "My Title");
    assert.equal(sentBody.company, "My Co");
    assert.equal(sentBody.raw_description, LONG_DESC);
  });
});

// --- previewJobByUrl ---

describe("previewJobByUrl", () => {
  it("returns error for an empty URL", async () => {
    const result = await previewJobByUrl({
      apiBaseUrl: "http://api",
      sourceUrl: "   ",
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
  });

  it("returns ok with the preview on success", async () => {
    const preview = makePreview({ source_url: "https://x.co/j", duplicate: false });
    const result = await previewJobByUrl({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(200, preview),
      sourceUrl: "https://x.co/j",
      sessionToken: "tok",
    });
    assert.equal(result.ok, true);
    assert.equal(result.preview.source_url, "https://x.co/j");
  });

  it("surfaces the manual-fallback detail on a 502", async () => {
    const result = await previewJobByUrl({
      apiBaseUrl: "http://api",
      fetchImpl: makeFetch(502, { detail: "Paste the job description manually." }),
      sourceUrl: "https://x.co/j",
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /paste/i);
  });

  it("returns error when the network throws", async () => {
    const result = await previewJobByUrl({
      apiBaseUrl: "http://api",
      fetchImpl: async () => {
        throw new Error("network");
      },
      sourceUrl: "https://x.co/j",
      sessionToken: "tok",
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /could not be reached/i);
  });
});
