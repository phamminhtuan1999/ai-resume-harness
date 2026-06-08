import assert from "node:assert/strict";
import test from "node:test";

import {
  getResumeFileValidationError,
  getValidationFieldErrors,
  readForm,
  RESUME_IMPORT_MAX_BYTES,
  validateImportedResumePayload,
  validateJobInput,
  validateMatchIdInput,
  validateMatchInput,
  validateProfileInput,
  validateResumeTextInput,
  validateResumeTitleInput,
  validateSaveApplicationInput,
  validateUpdateApplicationStatusInput,
} from "../src/lib/action-validation.mjs";

test("profile validation accepts supported AI target roles and coerces experience", () => {
  const result = validateProfileInput({
    current_role: "Senior Software Engineer",
    years_of_experience: "6",
    target_role: "AI Engineer",
    location_preference: "US remote",
    technical_background: "TypeScript, Python, SQL",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.years_of_experience, 6);
});

test("profile validation rejects missing current role and unsupported target role", () => {
  const result = validateProfileInput({
    current_role: "",
    years_of_experience: "6",
    target_role: "Product Manager",
  });

  assert.equal(result.success, false);
  assert.deepEqual(getValidationFieldErrors(result.error), {
    current_role: "Current role is required.",
    target_role: "Choose a supported target role.",
  });
});

test("resume text validation requires title and canonical text", () => {
  assert.equal(
    validateResumeTextInput({
      title: "Primary resume",
      raw_text: "Resume content",
      source_type: "text",
    }).success,
    true
  );

  const invalid = validateResumeTextInput({ title: "Primary resume", raw_text: "" });
  assert.equal(invalid.success, false);
  assert.deepEqual(getValidationFieldErrors(invalid.error), {
    raw_text: "Paste resume text or choose a resume file.",
  });
});

test("resume title validation supports file imports without pasted text", () => {
  assert.equal(validateResumeTitleInput({ title: "Imported resume" }).success, true);
  assert.equal(validateResumeTitleInput({ title: "" }).success, false);
});

test("imported resume payload validation accepts Docling-supported source metadata", () => {
  const result = validateImportedResumePayload({
    source_type: "docx",
    source_file_name: "resume.docx",
    source_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_size_bytes: 1234,
    canonical_markdown: "# Resume",
    import_status: "succeeded",
  });

  assert.equal(result.success, true);
});

test("job validation accepts manual job description and optional contact fields", () => {
  const result = validateJobInput({
    company: "Northstar AI",
    title: "Applied AI Engineer",
    job_url: "https://example.com/jobs/123",
    location: "Remote, US",
    raw_description: "Build AI workflow systems.",
    contact_name: "Maya Chen",
    contact_email: "maya@example.com",
    contact_linkedin_url: "https://linkedin.com/in/mayachen",
    contact_notes: "Recruiter contact",
  });

  assert.equal(result.success, true);
});

test("job validation rejects invalid job and contact URLs/emails", () => {
  const result = validateJobInput({
    company: "Northstar AI",
    title: "Applied AI Engineer",
    job_url: "not a url",
    raw_description: "Build AI workflow systems.",
    contact_email: "not an email",
    contact_linkedin_url: "not a url",
  });

  assert.equal(result.success, false);
  assert.deepEqual(getValidationFieldErrors(result.error), {
    job_url: "Enter a valid job URL.",
    contact_email: "Enter a valid contact email.",
    contact_linkedin_url: "Enter a valid LinkedIn URL.",
  });
});

test("match validation requires resume and job UUIDs", () => {
  assert.equal(
    validateMatchInput({
      resume_id: "c7d35bfe-d78f-47da-876f-3726835f6cc0",
      job_id: "c70ccf28-e33c-4c73-895c-7f56679454ed",
    }).success,
    true
  );

  const invalid = validateMatchInput({ resume_id: "resume", job_id: "" });
  assert.equal(invalid.success, false);
  assert.deepEqual(getValidationFieldErrors(invalid.error), {
    resume_id: "Choose a resume.",
    job_id: "Choose a job.",
  });
});

test("resume file validation accepts supported imports and rejects unsafe files", () => {
  assert.equal(
    getResumeFileValidationError(
      new File(["resume"], "resume.pdf", { type: "application/pdf" })
    ),
    ""
  );
  assert.equal(
    getResumeFileValidationError(
      new File(["resume"], "resume.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ),
    ""
  );
  assert.equal(
    getResumeFileValidationError(new File(["resume"], "resume.png", { type: "image/png" })),
    ""
  );
  assert.equal(
    getResumeFileValidationError(new File(["resume"], "resume.exe", { type: "application/x-msdownload" })),
    "Choose a PDF, DOCX, image, Markdown, or plain text resume."
  );
  assert.equal(
    getResumeFileValidationError(
      new File([new Uint8Array(RESUME_IMPORT_MAX_BYTES + 1)], "resume.pdf", {
        type: "application/pdf",
      })
    ),
    "Resume file must be 10 MB or smaller."
  );
});

test("match id validation requires a UUID", () => {
  assert.equal(
    validateMatchIdInput({ match_id: "98ed9270-a036-4cb3-a644-613854790963" }).success,
    true
  );

  assert.equal(validateMatchIdInput({ match_id: "match" }).success, false);
});

test("application save validation accepts job UUID and optional match UUID", () => {
  assert.equal(
    validateSaveApplicationInput({
      job_id: "ffb2c3c7-9914-497a-935a-26707e5b10bf",
      match_id: "98ed9270-a036-4cb3-a644-613854790963",
    }).success,
    true
  );

  const withoutMatch = validateSaveApplicationInput({
    job_id: "ffb2c3c7-9914-497a-935a-26707e5b10bf",
    match_id: "",
  });
  assert.equal(withoutMatch.success, true);
  assert.equal(withoutMatch.data.match_id, null);
});

test("application status validation accepts only the tracker workflow statuses", () => {
  assert.equal(
    validateUpdateApplicationStatusInput({
      application_id: "43c75e3c-c5da-4a3c-b33f-16c1b2ee9f6c",
      status: "interviewing",
    }).success,
    true
  );

  assert.equal(
    validateUpdateApplicationStatusInput({
      application_id: "43c75e3c-c5da-4a3c-b33f-16c1b2ee9f6c",
      status: "screen",
    }).success,
    false
  );
});

test("readForm converts FormData fields into an object", () => {
  const formData = new FormData();
  formData.set("company", "Northstar AI");
  formData.set("title", "Applied AI Engineer");

  assert.deepEqual(readForm(formData), {
    company: "Northstar AI",
    title: "Applied AI Engineer",
  });
});
