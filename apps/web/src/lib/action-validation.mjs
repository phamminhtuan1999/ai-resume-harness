import { z } from "zod";

const profileSchema = z.object({
  current_role: z.string().trim().min(1),
  years_of_experience: z.coerce.number().min(0).max(60),
  target_role: z.enum([
    "AI Engineer",
    "Applied AI Engineer",
    "LLM Engineer",
    "GenAI Engineer",
    "ML Engineer",
  ]),
  location_preference: z.string().trim().optional(),
  technical_background: z.string().trim().optional(),
});

const resumeSchema = z.object({
  title: z.string().trim().min(1),
  raw_text: z.string().trim().min(1),
  source_type: z.enum(["text", "markdown"]).default("text"),
});

const resumeTitleSchema = z.object({
  title: z.string().trim().min(1),
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
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  job_url: z.string().trim().url().or(z.literal("")).optional(),
  location: z.string().trim().optional(),
  raw_description: z.string().trim().min(1),
  contact_name: z.string().trim().optional(),
  contact_email: z.string().trim().email().or(z.literal("")).optional(),
  contact_linkedin_url: z.string().trim().url().or(z.literal("")).optional(),
  contact_notes: z.string().trim().optional(),
});

const matchSchema = z.object({
  resume_id: z.string().trim().uuid(),
  job_id: z.string().trim().uuid(),
});

const matchIdSchema = z.object({
  match_id: z.string().trim().uuid(),
});

export function readForm(formData) {
  return Object.fromEntries(formData.entries());
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
