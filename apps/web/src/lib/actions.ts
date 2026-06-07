"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import {
  readForm,
  validateJobInput,
  validateMatchIdInput,
  validateMatchInput,
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
import { analyzeResumeJobFit } from "@/lib/match-analyzer.mjs";
import { buildTailoredResumeDraft } from "@/lib/resume-draft-generator.mjs";
import { buildResumeSuggestions } from "@/lib/resume-suggestion-generator.mjs";
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

function successWithRedirect(message: string, redirectTo: string): ActionState {
  return { status: "success", message, redirectTo };
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

export async function generateMatchAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateMatchInput(readForm(formData));
  if (!parsed.success) {
    return failure("Choose a resume and job before generating analysis.");
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: resume, error: resumeError }, { data: job, error: jobError }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id,raw_text")
      .eq("id", parsed.data.resume_id)
      .eq("user_id", context.userProfileId)
      .single(),
    supabase
      .from("jobs")
      .select("id,raw_description")
      .eq("id", parsed.data.job_id)
      .eq("user_id", context.userProfileId)
      .single(),
  ]);

  if (resumeError || jobError || !resume?.raw_text || !job?.raw_description) {
    return failure("Unable to load the selected resume and job for analysis.");
  }

  const analysis = analyzeResumeJobFit({
    resumeText: resume.raw_text,
    jobDescription: job.raw_description,
  });

  const now = new Date().toISOString();
  const [{ error: resumeUpdateError }, { error: jobUpdateError }, { data: match, error: matchError }] =
    await Promise.all([
      supabase
        .from("resumes")
        .update({
          structured_json: analysis.structured_resume,
          parse_status: "parsed",
          updated_at: now,
        })
        .eq("id", parsed.data.resume_id)
        .eq("user_id", context.userProfileId),
      supabase
        .from("jobs")
        .update({
          structured_json: analysis.structured_job,
          parse_status: "parsed",
          updated_at: now,
        })
        .eq("id", parsed.data.job_id)
        .eq("user_id", context.userProfileId),
      supabase
        .from("matches")
        .insert({
          user_id: context.userProfileId,
          resume_id: parsed.data.resume_id,
          job_id: parsed.data.job_id,
          overall_score: analysis.overall_score,
          skill_score: analysis.skill_score,
          experience_score: analysis.experience_score,
          ai_readiness_score: analysis.ai_readiness_score,
          ats_keyword_score: analysis.ats_keyword_score,
          seniority_score: analysis.seniority_score,
          strengths_json: analysis.strengths_json,
          weaknesses_json: analysis.weaknesses_json,
          missing_skills_json: analysis.missing_skills_json,
          risks_json: analysis.risks_json,
          explanation_json: analysis.explanation_json,
        })
        .select("id")
        .single(),
    ]);

  if (resumeUpdateError || jobUpdateError || matchError || !match?.id) {
    return failure("Match analysis save failed. Confirm the Period 2 matches schema exists.");
  }

  revalidatePath("/matches");
  revalidatePath(`/matches/${match.id}`);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${parsed.data.job_id}`);
  revalidatePath("/resumes");
  revalidatePath(`/resumes/${parsed.data.resume_id}`);
  revalidatePath("/dashboard");

  return successWithRedirect("Match analysis generated.", `/matches/${match.id}`);
}

export async function generateResumeSuggestionsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateMatchIdInput(readForm(formData));
  if (!parsed.success) {
    return failure("Choose a valid match before generating resume suggestions.");
  }

  const supabase = getSupabaseServiceClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "strengths_json",
        "weaknesses_json",
        "missing_skills_json",
      ].join(",")
    )
    .eq("id", parsed.data.match_id)
    .eq("user_id", context.userProfileId)
    .single();

  if (matchError || !match) {
    return failure("Unable to load the selected match for resume suggestions.");
  }

  const sourceMatch = match as unknown as {
    id: string;
    strengths_json: unknown;
    weaknesses_json: unknown;
    missing_skills_json: unknown;
  };

  const suggestions = buildResumeSuggestions({ match: sourceMatch }).map((suggestion) => ({
    match_id: parsed.data.match_id,
    ...suggestion,
  }));

  const { error: deleteError } = await supabase
    .from("resume_suggestions")
    .delete()
    .eq("match_id", parsed.data.match_id);

  if (deleteError) {
    return failure("Resume suggestion save failed. Confirm the Period 3 schema exists.");
  }

  const { error: insertError } = await supabase.from("resume_suggestions").insert(suggestions);

  if (insertError) {
    return failure("Resume suggestion save failed. Confirm the Period 3 schema exists.");
  }

  revalidatePath(`/matches/${parsed.data.match_id}`);
  revalidatePath(`/matches/${parsed.data.match_id}/resume-suggestions`);

  return success("Resume suggestions generated.");
}

export async function generateResumeDraftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateMatchIdInput(readForm(formData));
  if (!parsed.success) {
    return failure("Choose a valid match before generating a resume draft.");
  }

  const supabase = getSupabaseServiceClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "resume_id",
        "job_id",
        "resumes(id,title,raw_text)",
        "jobs(id,company,title)",
      ].join(",")
    )
    .eq("id", parsed.data.match_id)
    .eq("user_id", context.userProfileId)
    .single();

  if (matchError || !match) {
    return failure("Unable to load the selected match for resume draft generation.");
  }

  const sourceMatch = match as unknown as {
    id: string;
    resume_id: string;
    job_id: string;
    resumes: { id: string; title: string; raw_text: string } | null;
    jobs: { id: string; company: string; title: string } | null;
  };

  if (!sourceMatch.resumes?.raw_text || !sourceMatch.jobs?.title) {
    return failure("The selected match is missing resume or job context.");
  }

  const { data: suggestions, error: suggestionsError } = await supabase
    .from("resume_suggestions")
    .select("suggested_text,truth_guard_status")
    .eq("match_id", parsed.data.match_id)
    .order("created_at", { ascending: true });

  if (suggestionsError) {
    return failure("Unable to load resume suggestions for this match.");
  }

  const draft = buildTailoredResumeDraft({
    resume: sourceMatch.resumes,
    job: sourceMatch.jobs,
    suggestions: suggestions ?? [],
  });

  const { data: version, error: versionError } = await supabase
    .from("resume_versions")
    .insert({
      user_id: context.userProfileId,
      resume_id: sourceMatch.resume_id,
      job_id: sourceMatch.job_id,
      match_id: parsed.data.match_id,
      title: draft.title,
      content_markdown: draft.content_markdown,
    })
    .select("id")
    .single();

  if (versionError || !version?.id) {
    return failure("Resume draft save failed. Confirm the Period 3 resume_versions schema exists.");
  }

  revalidatePath(`/matches/${parsed.data.match_id}`);
  revalidatePath(`/matches/${parsed.data.match_id}/resume-draft`);

  return success("Markdown resume draft generated.");
}
