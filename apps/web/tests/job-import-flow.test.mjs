import assert from "node:assert/strict";
import test from "node:test";

import { importJobByUrl } from "../src/lib/job-import-flow.mjs";

const API = "https://api.test";
const TOKEN = "session-token";

function jsonResponse(ok, body, { status = ok ? 200 : 502 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

test("importJobByUrl rejects an empty URL before calling the API", async () => {
  let called = false;
  const result = await importJobByUrl({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    sourceUrl: "   ",
    fetchImpl: async () => {
      called = true;
      return jsonResponse(true, {});
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.equal(result.fieldErrors.source_url, "Enter a job URL.");
});

test("importJobByUrl requires an API base URL", async () => {
  const result = await importJobByUrl({
    apiBaseUrl: "",
    sessionToken: TOKEN,
    sourceUrl: "https://acme.com/jobs/1",
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /not configured/);
});

test("importJobByUrl requires a session token", async () => {
  const result = await importJobByUrl({
    apiBaseUrl: API,
    sessionToken: "",
    sourceUrl: "https://acme.com/jobs/1",
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /authenticate/);
});

test("importJobByUrl posts the trimmed URL and returns the saved job", async () => {
  const seen = {};
  const result = await importJobByUrl({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    sourceUrl: "  https://acme.com/jobs/1  ",
    fetchImpl: async (url, init) => {
      seen.url = url;
      seen.init = init;
      return jsonResponse(true, {
        job_id: "job_1",
        duplicate: false,
        company: "Acme",
        title: "AI Engineer",
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.job.job_id, "job_1");
  assert.equal(seen.url, `${API}/api/jobs/import-url`);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(seen.init.body), { source_url: "https://acme.com/jobs/1" });
});

test("importJobByUrl surfaces the provider fallback detail on failure", async () => {
  const detail = "We could not fetch this job page. Paste the job description manually.";
  const result = await importJobByUrl({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    sourceUrl: "https://acme.com/jobs/1",
    fetchImpl: async () => jsonResponse(false, { detail }, { status: 502 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, detail);
});

test("importJobByUrl reports a network error", async () => {
  const result = await importJobByUrl({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    sourceUrl: "https://acme.com/jobs/1",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /could not be reached/);
});

test("importJobByUrl rejects a malformed success payload", async () => {
  const result = await importJobByUrl({
    apiBaseUrl: API,
    sessionToken: TOKEN,
    sourceUrl: "https://acme.com/jobs/1",
    fetchImpl: async () => jsonResponse(true, { company: "Acme" }),
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /invalid data/);
});
