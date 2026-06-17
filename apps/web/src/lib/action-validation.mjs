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
  // Location is captured structurally (US-057): a country code chosen from a
  // list plus free-text city. Cross-field rules (valid country, phone region,
  // E.164 normalization, composed location_preference) live in
  // validateProfileContact (contact-info.mjs); this schema only checks shape.
  location_country: z.string().trim().optional(),
  location_city: z.string().trim().optional(),
  contact_email: z
    .string()
    .trim()
    .email("Enter a valid contact email.")
    .or(z.literal(""))
    .optional(),
  phone: z.string().trim().max(40, "Phone must be 40 characters or less.").optional(),
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

// US-058 lightweight rename: only the safe display fields a user can fix after
// import. Canonical parsed content (raw_text, structured extraction) is never
// touched by this path.
const jobRenameSchema = z.object({
  title: z.string().trim().min(1, "Job title is required."),
  company: z.string().trim().min(1, "Company is required."),
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

const jobUrlSchema = z.object({
  source_url: z
    .string()
    .trim()
    .min(1, "Enter a job URL.")
    .url("Enter a valid job URL, including https://."),
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

// US-082: guards the owned-row id + shapes the raw interview fields. Domain rules
// (date validity, known stage, notes cap, empty -> null) live in the pure
// normalizeInterviewSchedule helper so they stay unit-testable without zod.
const updateInterviewScheduleSchema = z.object({
  application_id: z.string().trim().uuid("A valid application is required."),
  interview_date: z.string().optional(),
  interview_stage: z.string().optional(),
  interview_notes: z.string().optional(),
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

export function validateJobRenameInput(input) {
  return jobRenameSchema.safeParse(input);
}

export function validateImportedResumePayload(input) {
  return importedResumeSchema.safeParse(input);
}

export function validateJobInput(input) {
  return jobSchema.safeParse(input);
}

export function validateJobUrlInput(input) {
  return jobUrlSchema.safeParse(input);
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

export function validateUpdateInterviewScheduleInput(input) {
  return updateInterviewScheduleSchema.safeParse(input);
}
