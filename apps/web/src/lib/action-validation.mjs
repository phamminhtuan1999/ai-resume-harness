import { z } from "zod";

import { APPLICATION_STATUSES } from "./application-tracker.mjs";

export const RESUME_IMPORT_MAX_BYTES = 10_485_760;

export const SUPPORTED_RESUME_FILE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".md",
];

export const SUPPORTED_RESUME_FILE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
];

const profileSchema = z.object({
  current_role: z.string().trim().min(1, "Current role is required."),
  years_of_experience: z.coerce
    .number({ error: "Years of experience is required." })
    .min(0, "Years of experience cannot be negative.")
    .max(60, "Years of experience must be 60 or less."),
  target_role: z.enum(
    ["AI Engineer", "Applied AI Engineer", "LLM Engineer", "GenAI Engineer", "ML Engineer"],
    { error: "Choose a supported target role." }
  ),
  location_preference: z.string().trim().optional(),
  technical_background: z.string().trim().optional(),
});

const resumeSchema = z.object({
  title: z.string().trim().min(1, "Resume title is required."),
  raw_text: z.string().trim().min(1, "Paste resume text or choose a resume file."),
  source_type: z.enum(["text", "markdown"]).default("text"),
});

const resumeTitleSchema = z.object({
  title: z.string().trim().min(1, "Resume title is required."),
});

const importedResumeSchema = z.object({
  source_type: z.enum(["text", "markdown", "pdf", "docx", "image"]),
  source_file_name: z.string().min(1),
  source_mime_type: z.string().min(1),
  source_size_bytes: z.number().int().min(0),
  canonical_markdown: z.string().min(1),
  import_status: z.enum(["succeeded"]),
});

const jobSchema = z.object({
  company: z.string().trim().min(1, "Company is required."),
  title: z.string().trim().min(1, "Job title is required."),
  job_url: z.string().trim().url("Enter a valid job URL.").or(z.literal("")).optional(),
  location: z.string().trim().optional(),
  raw_description: z.string().trim().min(1, "Job description is required."),
  contact_name: z.string().trim().optional(),
  contact_email: z.string().trim().email("Enter a valid contact email.").or(z.literal("")).optional(),
  contact_linkedin_url: z
    .string()
    .trim()
    .url("Enter a valid LinkedIn URL.")
    .or(z.literal(""))
    .optional(),
  contact_notes: z.string().trim().optional(),
});

const matchSchema = z.object({
  resume_id: z.string().trim().uuid("Choose a resume."),
  job_id: z.string().trim().uuid("Choose a job."),
});

const matchIdSchema = z.object({
  match_id: z.string().trim().uuid("A valid match is required."),
});

const optionalUuidSchema = z
  .string()
  .trim()
  .uuid()
  .or(z.literal(""))
  .optional()
  .transform((value) => value || null);

const saveApplicationSchema = z.object({
  job_id: z.string().trim().uuid("A valid job is required."),
  match_id: optionalUuidSchema,
});

const updateApplicationStatusSchema = z.object({
  application_id: z.string().trim().uuid("A valid application is required."),
  status: z.enum(APPLICATION_STATUSES, { error: "Choose a valid tracker status." }),
});

export function readForm(formData) {
  return Object.fromEntries(formData.entries());
}

export function getValidationFieldErrors(error) {
  return error.issues.reduce((fieldErrors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
    return fieldErrors;
  }, {});
}

export function getResumeFileValidationError(file) {
  if (!(file instanceof File) || file.size === 0) {
    return "";
  }

  if (file.size > RESUME_IMPORT_MAX_BYTES) {
    return "Resume file must be 10 MB or smaller.";
  }

  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = SUPPORTED_RESUME_FILE_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension)
  );
  const hasSupportedMimeType = SUPPORTED_RESUME_FILE_MIME_TYPES.includes(file.type);

  if (!hasSupportedExtension && !hasSupportedMimeType) {
    return "Choose a PDF, DOCX, image, Markdown, or plain text resume.";
  }

  return "";
}

export function validateProfileInput(input) {
  return profileSchema.safeParse(input);
}

export function validateResumeTextInput(input) {
  return resumeSchema.safeParse(input);
}

export function validateResumeTitleInput(input) {
  return resumeTitleSchema.safeParse(input);
}

export function validateImportedResumePayload(input) {
  return importedResumeSchema.safeParse(input);
}

export function validateJobInput(input) {
  return jobSchema.safeParse(input);
}

export function validateMatchInput(input) {
  return matchSchema.safeParse(input);
}

export function validateMatchIdInput(input) {
  return matchIdSchema.safeParse(input);
}

export function validateSaveApplicationInput(input) {
  return saveApplicationSchema.safeParse(input);
}

export function validateUpdateApplicationStatusInput(input) {
  return updateApplicationStatusSchema.safeParse(input);
}
