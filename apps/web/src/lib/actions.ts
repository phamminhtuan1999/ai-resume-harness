"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentAppUser } from "@/lib/auth/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

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

async function requireWritableContext(): Promise<
  | { ok: true; userProfileId: string }
  | { ok: false; message: string }
> {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    return {
      ok: false,
      message: "Clerk is not configured or no signed-in user is available.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "Supabase is not configured. Add env vars before saving data.",
    };
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        clerk_user_id: appUser.clerkUserId,
        email: appUser.email,
        full_name: appUser.fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      message: "Unable to prepare the user profile for saving.",
    };
  }

  return { ok: true, userProfileId: data.id };
}

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function logSkippedAction(message: string) {
  console.warn(`[ApplyWise action skipped] ${message}`);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const context = await requireWritableContext();
  if (!context.ok) {
    logSkippedAction(context.message);
    return;
  }

  const parsed = profileSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    logSkippedAction("Profile fields are incomplete or invalid.");
    return;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", context.userProfileId);

  if (error) {
    logSkippedAction("Profile save failed.");
    return;
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function saveResumeAction(formData: FormData): Promise<void> {
  const context = await requireWritableContext();
  if (!context.ok) {
    logSkippedAction(context.message);
    return;
  }

  const parsed = resumeSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    logSkippedAction("Resume title and text are required.");
    return;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("resumes").insert({
    user_id: context.userProfileId,
    title: parsed.data.title,
    raw_text: parsed.data.raw_text,
    source_type: parsed.data.source_type,
    import_status: "not_required",
  });

  if (error) {
    logSkippedAction("Resume save failed.");
    return;
  }

  revalidatePath("/resumes");
  revalidatePath("/dashboard");
}

export async function saveJobAction(formData: FormData): Promise<void> {
  const context = await requireWritableContext();
  if (!context.ok) {
    logSkippedAction(context.message);
    return;
  }

  const parsed = jobSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    logSkippedAction("Job fields are incomplete or invalid.");
    return;
  }

  const clean = parsed.data;
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("jobs").insert({
    user_id: context.userProfileId,
    company: clean.company,
    title: clean.title,
    job_url: clean.job_url || null,
    location: clean.location || null,
    raw_description: clean.raw_description,
    contact_name: clean.contact_name || null,
    contact_email: clean.contact_email || null,
    contact_linkedin_url: clean.contact_linkedin_url || null,
    contact_notes: clean.contact_notes || null,
  });

  if (error) {
    logSkippedAction("Job save failed.");
    return;
  }

  revalidatePath("/jobs");
  revalidatePath("/tracker");
}
