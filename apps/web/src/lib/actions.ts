"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import {
  readForm,
  validateJobInput,
  validateProfileInput,
  validateResumeTextInput,
  validateResumeTitleInput,
} from "@/lib/action-validation.mjs";
import { getCurrentAppUser, getCurrentSessionToken } from "@/lib/auth/server";
import { hasSupabaseEnv, serverEnv } from "@/lib/env";
import {
  buildImportedResumeInsert,
  importResumeFile,
  isUploadedResumeFile,
} from "@/lib/resume-import-flow.mjs";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

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

function logSkippedAction(message: string) {
  console.warn(`[ApplyWise action skipped] ${message}`);
}

function success(message: string): ActionState {
  return { status: "success", message };
}

function failure(message: string): ActionState {
  logSkippedAction(message);
  return { status: "error", message };
}

export async function saveProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateProfileInput(readForm(formData));
  if (!parsed.success) {
    return failure("Profile fields are incomplete or invalid.");
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", context.userProfileId);

  if (error) {
    return failure("Profile save failed.");
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return success("Profile saved.");
}

export async function saveResumeAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const titleParsed = validateResumeTitleInput(readForm(formData));
  if (!titleParsed.success) {
    return failure("Resume title is required.");
  }

  const resumeFile = formData.get("resume_file");
  const hasUploadedFile = isUploadedResumeFile(resumeFile);

  if (hasUploadedFile) {
    const sessionToken = await getCurrentSessionToken();
    const importResult = await importResumeFile({
      apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
      resumeFile,
      sessionToken,
    });

    if (!importResult.ok) {
      return failure(importResult.message);
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("resumes").insert(
      buildImportedResumeInsert({
        imported: importResult.imported,
        title: titleParsed.data.title,
        userProfileId: context.userProfileId,
      })
    );

    if (error) {
      return failure("Resume save failed after import.");
    }

    revalidatePath("/resumes");
    revalidatePath("/dashboard");
    return success("Resume imported and saved.");
  }

  const parsed = validateResumeTextInput(readForm(formData));
  if (!parsed.success) {
    return failure("Resume title and either pasted text or an uploaded file are required.");
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
    return failure("Resume save failed.");
  }

  revalidatePath("/resumes");
  revalidatePath("/dashboard");
  return success("Resume saved.");
}

export async function saveJobAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateJobInput(readForm(formData));
  if (!parsed.success) {
    return failure("Job fields are incomplete or invalid.");
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
    return failure("Job save failed.");
  }

  revalidatePath("/jobs");
  revalidatePath("/tracker");
  revalidatePath("/dashboard");
  return success("Job saved.");
}
