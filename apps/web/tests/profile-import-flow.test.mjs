import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCandidateProfileFromResume,
  saveImportedCandidateProfile,
} from "../src/lib/profile-import-flow.mjs";

test("extractCandidateProfileFromResume calls the protected resume extraction endpoint", async () => {
  const calls = [];
  const result = await extractCandidateProfileFromResume({
    apiBaseUrl: "http://localhost:8000",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        resume_id: "resume_123",
        candidate_profile: {
          basic_info: { full_name: "Avery Candidate" },
          skills: { programming_languages: ["Python"] },
        },
        confidence: { overall: 0.9, low_confidence_fields: [] },
      });
    },
    resumeId: "resume_123",
    sessionToken: "session_test",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:8000/api/resumes/resume_123/extract-profile");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, { Authorization: "Bearer session_test" });
  assert.equal(result.payload.candidate_profile.basic_info.full_name, "Avery Candidate");
});

test("saveImportedCandidateProfile submits reviewed profile JSON to the API", async () => {
  const calls = [];
  const candidateProfile = {
    basic_info: { current_title: "Senior Software Engineer" },
    ai_metadata: { suggested_target_roles: ["Applied AI Engineer"] },
  };
  const confidence = { overall: 0.82, low_confidence_fields: ["basic_info.phone"] };

  const result = await saveImportedCandidateProfile({
    apiBaseUrl: "http://localhost:8000",
    candidateProfile,
    confidence,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        profile_id: "profile_123",
        resume_id: "resume_123",
        profile_source: "resume_import",
      });
    },
    resumeId: "resume_123",
    sessionToken: "session_test",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:8000/api/profile/import-from-resume");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, {
    Authorization: "Bearer session_test",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    resume_id: "resume_123",
    candidate_profile: candidateProfile,
    confidence,
  });
  assert.deepEqual(result.payload, {
    profile_id: "profile_123",
    resume_id: "resume_123",
    profile_source: "resume_import",
  });
});

test("profile import flow returns API detail and local configuration errors", async () => {
  assert.deepEqual(
    await extractCandidateProfileFromResume({
      apiBaseUrl: undefined,
      resumeId: "resume_123",
      sessionToken: "session_test",
    }),
    { ok: false, message: "Candidate profile import API is not configured." }
  );

  assert.deepEqual(
    await saveImportedCandidateProfile({
      apiBaseUrl: "http://localhost:8000",
      candidateProfile: {},
      confidence: {},
      fetchImpl: async () => Response.json({ detail: "Resume not found." }, { status: 404 }),
      resumeId: "resume_123",
      sessionToken: "session_test",
    }),
    { ok: false, message: "Resume not found." }
  );
});
