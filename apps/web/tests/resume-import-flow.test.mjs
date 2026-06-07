import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImportedResumeInsert,
  importResumeFile,
  isUploadedResumeFile,
} from "../src/lib/resume-import-flow.mjs";

test("isUploadedResumeFile detects non-empty File uploads", () => {
  assert.equal(isUploadedResumeFile(new File(["resume"], "resume.txt", { type: "text/plain" })), true);
  assert.equal(isUploadedResumeFile(new File([], "empty.txt", { type: "text/plain" })), false);
  assert.equal(isUploadedResumeFile("not a file"), false);
});

test("importResumeFile sends uploaded File to protected import API", async () => {
  const resumeFile = new File(["Browser file proof text"], "resume.txt", { type: "text/plain" });
  const calls = [];

  const result = await importResumeFile({
    apiBaseUrl: "http://localhost:8000",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        source_type: "text",
        source_file_name: "resume.txt",
        source_mime_type: "text/plain",
        source_size_bytes: 23,
        canonical_markdown: "Browser file proof text",
        import_status: "succeeded",
      });
    },
    resumeFile,
    sessionToken: "session_test",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:8000/api/resumes/import/preview");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, { Authorization: "Bearer session_test" });
  assert.equal(calls[0].init.body instanceof FormData, true);

  const uploadedFile = calls[0].init.body.get("file");
  assert.equal(uploadedFile instanceof File, true);
  assert.equal(uploadedFile.name, "resume.txt");
  assert.equal(uploadedFile.type, "text/plain");
  assert.equal(await uploadedFile.text(), "Browser file proof text");
  assert.deepEqual(result.imported, {
    source_type: "text",
    source_file_name: "resume.txt",
    source_mime_type: "text/plain",
    source_size_bytes: 23,
    canonical_markdown: "Browser file proof text",
    import_status: "succeeded",
  });
});

test("importResumeFile returns API detail for rejected uploads", async () => {
  const result = await importResumeFile({
    apiBaseUrl: "http://localhost:8000",
    fetchImpl: async () =>
      Response.json({ detail: "Unsupported resume file type." }, { status: 415 }),
    resumeFile: new File(["bad"], "resume.exe", { type: "application/octet-stream" }),
    sessionToken: "session_test",
  });

  assert.deepEqual(result, {
    ok: false,
    message: "Unsupported resume file type.",
  });
});

test("importResumeFile rejects missing API configuration and auth token", async () => {
  const resumeFile = new File(["resume"], "resume.txt", { type: "text/plain" });

  assert.deepEqual(
    await importResumeFile({ apiBaseUrl: undefined, resumeFile, sessionToken: "session_test" }),
    { ok: false, message: "Resume import API is not configured." }
  );
  assert.deepEqual(
    await importResumeFile({ apiBaseUrl: "http://localhost:8000", resumeFile, sessionToken: null }),
    { ok: false, message: "Unable to authenticate resume import." }
  );
});

test("buildImportedResumeInsert maps imported metadata into the resumes row shape", () => {
  assert.deepEqual(
    buildImportedResumeInsert({
      imported: {
        source_type: "docx",
        source_file_name: "resume.docx",
        source_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_size_bytes: 2048,
        canonical_markdown: "# Converted Resume",
        import_status: "succeeded",
      },
      title: "Imported resume",
      userProfileId: "profile_123",
    }),
    {
      user_id: "profile_123",
      title: "Imported resume",
      raw_text: "# Converted Resume",
      source_type: "docx",
      source_file_name: "resume.docx",
      source_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_size_bytes: 2048,
      import_status: "succeeded",
    }
  );
});
