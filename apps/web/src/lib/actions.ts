"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import {
  getValidationFieldErrors,
  readForm,
  validateJobInput,
  validateJobUrlInput,
  validateMatchIdInput,
  validateMatchInput,
  validateProfileInput,
  validateResumeTextInput,
  validateResumeTitleInput,
  validateSaveApplicationInput,
  validateUpdateApplicationStatusInput,
} from "@/lib/action-validation.mjs";
import { getCurrentAppUser, getCurrentSessionToken } from "@/lib/auth/server";
import { hasSupabaseEnv, serverEnv } from "@/lib/env";
import {
  buildImportedResumeInsert,
  importResumeFile,
  isUploadedResumeFile,
} from "@/lib/resume-import-flow.mjs";
import { importJobByUrl } from "@/lib/job-import-flow.mjs";
import {
  AIWorkflowError,
  patchResumeSuggestion,
  regenerateActivityDescription,
  runFullWorkflow,
  runMatchAnalysis,
  runMatchSubWorkflow,
  runWorkflow,
} from "@/lib/ai-workflow-client.mjs";
import { analyzeResumeJobFit } from "@/lib/match-analyzer.mjs";
import { saveImportedCandidateProfile } from "@/lib/profile-import-flow.mjs";
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

function failure(message: string, fieldErrors?: Record<string, string>): ActionState {
  logSkippedAction(message);
  return { status: "error", message, fieldErrors };
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
    return failure(
      "Profile fields are incomplete or invalid.",
      getValidationFieldErrors(parsed.error)
    );
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

export async function saveImportedProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const resumeId = String(formData.get("resume_id") || "");
  const candidateProfileJson = String(formData.get("candidate_profile_json") || "");
  const confidenceJson = String(formData.get("confidence_json") || "");

  let candidateProfile: unknown;
  let confidence: unknown;
  try {
    candidateProfile = JSON.parse(candidateProfileJson);
    confidence = confidenceJson
      ? JSON.parse(confidenceJson)
      : { overall: 1, low_confidence_fields: [] };
  } catch {
    return failure("Review JSON must be valid before importing.", {
      candidate_profile_json: "Enter valid candidate profile JSON.",
    });
  }

  if (!resumeId) {
    return failure("Resume is required before profile import.", {
      resume_id: "Resume is required.",
    });
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await saveImportedCandidateProfile({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    candidateProfile,
    confidence,
    resumeId,
    sessionToken,
  });

  if (!result.ok) {
    return failure(result.message);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return successWithRedirect("Profile imported from resume.", "/profile");
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
    return failure("Resume title is required.", getValidationFieldErrors(titleParsed.error));
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
      return failure(importResult.message, importResult.fieldErrors);
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
    return failure(
      "Resume title and either pasted text or an uploaded file are required.",
      getValidationFieldErrors(parsed.error)
    );
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
    return failure("Job fields are incomplete or invalid.", getValidationFieldErrors(parsed.error));
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

export async function importJobByUrlAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateJobUrlInput(readForm(formData));
  if (!parsed.success) {
    return failure("Enter a valid job URL.", getValidationFieldErrors(parsed.error));
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await importJobByUrl({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    sourceUrl: parsed.data.source_url,
    sessionToken,
  });

  if (!result.ok) {
    // Any fetch/extract failure surfaces on the URL field so the form can offer
    // the manual-paste fallback with the link preserved.
    return failure(result.message, { source_url: result.message });
  }

  // Best-effort: score the freshly imported job against the most recent resume
  // so it is immediately analyzable. Never blocks or fails the import.
  if (!result.job.duplicate) {
    await scoreImportedJob({ userProfileId: context.userProfileId, jobId: result.job.job_id });
  }

  revalidatePath("/jobs");
  revalidatePath("/tracker");
  revalidatePath("/dashboard");
  const message = result.job.duplicate
    ? "This job was already saved. Opening it."
    : "Job fetched and saved.";
  return successWithRedirect(message, `/jobs/${result.job.job_id}`);
}

async function scoreImportedJob({
  userProfileId,
  jobId,
}: {
  userProfileId: string;
  jobId: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const [{ data: resumeRows }, { data: job }] = await Promise.all([
      supabase
        .from("resumes")
        .select("id,raw_text")
        .eq("user_id", userProfileId)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("jobs")
        .select("id,raw_description")
        .eq("id", jobId)
        .eq("user_id", userProfileId)
        .single(),
    ]);

    const resume = (resumeRows ?? []).find(
      (row) => typeof row?.raw_text === "string" && row.raw_text.trim().length > 0
    );
    if (!resume?.raw_text || !job?.raw_description) {
      return;
    }

    const analysis = analyzeResumeJobFit({
      resumeText: resume.raw_text,
      jobDescription: job.raw_description,
    });
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("jobs")
        .update({
          structured_json: analysis.structured_job,
          parse_status: "parsed",
          updated_at: now,
        })
        .eq("id", jobId)
        .eq("user_id", userProfileId),
      supabase.from("matches").insert({
        user_id: userProfileId,
        resume_id: resume.id,
        job_id: jobId,
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
      }),
    ]);
  } catch (error) {
    logSkippedAction(`Auto-scoring imported job skipped: ${String(error)}`);
  }
}

export async function saveApplicationAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateSaveApplicationInput(readForm(formData));
  if (!parsed.success) {
    return failure(
      "Choose a valid job before saving it to the tracker.",
      getValidationFieldErrors(parsed.error)
    );
  }

  const supabase = getSupabaseServiceClient();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", parsed.data.job_id)
    .eq("user_id", context.userProfileId)
    .single();

  if (jobError || !job?.id) {
    return failure("Unable to load the selected job for this account.");
  }

  if (parsed.data.match_id) {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id,job_id")
      .eq("id", parsed.data.match_id)
      .eq("user_id", context.userProfileId)
      .single();

    if (matchError || !match?.id || match.job_id !== parsed.data.job_id) {
      return failure("Unable to link that match to the selected job.");
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("applications")
    .select("id,match_id")
    .eq("user_id", context.userProfileId)
    .eq("job_id", parsed.data.job_id)
    .maybeSingle();

  if (existingError) {
    return failure("Tracker save failed. Confirm the Period 4 applications schema exists.");
  }

  if (existing?.id) {
    if (parsed.data.match_id && !existing.match_id) {
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          match_id: parsed.data.match_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", context.userProfileId);

      if (updateError) {
        return failure("Tracker save failed.");
      }
    }

    revalidatePath("/tracker");
    revalidatePath(`/jobs/${parsed.data.job_id}`);
    if (parsed.data.match_id) {
      revalidatePath(`/matches/${parsed.data.match_id}`);
    }

    return successWithRedirect("This job is already in your tracker.", "/tracker");
  }

  const { error: insertError } = await supabase.from("applications").insert({
    user_id: context.userProfileId,
    job_id: parsed.data.job_id,
    match_id: parsed.data.match_id,
    status: "saved",
  });

  if (insertError) {
    return failure("Tracker save failed. Confirm the Period 4 applications schema exists.");
  }

  revalidatePath("/tracker");
  revalidatePath(`/jobs/${parsed.data.job_id}`);
  if (parsed.data.match_id) {
    revalidatePath(`/matches/${parsed.data.match_id}`);
  }
  revalidatePath("/dashboard");

  return successWithRedirect("Job saved to tracker.", "/tracker");
}

export async function updateApplicationStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateUpdateApplicationStatusInput(readForm(formData));
  if (!parsed.success) {
    return failure("Choose a valid tracker status.", getValidationFieldErrors(parsed.error));
  }

  const updatePayload: {
    status: string;
    updated_at: string;
    applied_date?: string;
  } = {
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status === "applied") {
    updatePayload.applied_date = new Date().toISOString().slice(0, 10);
  }

  const supabase = getSupabaseServiceClient();
  const { data: application, error } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", parsed.data.application_id)
    .eq("user_id", context.userProfileId)
    .select("id,job_id,match_id")
    .single();

  if (error || !application?.id) {
    return failure("Tracker status update failed.");
  }

  revalidatePath("/tracker");
  revalidatePath(`/jobs/${application.job_id}`);
  if (application.match_id) {
    revalidatePath(`/matches/${application.match_id}`);
  }

  return success("Tracker status updated.");
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
    return failure(
      "Choose a resume and job before generating analysis.",
      getValidationFieldErrors(parsed.error)
    );
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

  if (resumeError || jobError || !resume?.id || !job?.id) {
    return failure("Unable to load the selected resume and job for analysis.");
  }

  // Duplicate guard: one analysis per (resume, job) pair. If this resume has
  // already been analyzed against this job, open the existing report instead of
  // creating a duplicate. The user can Regenerate from there for a fresh run.
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", context.userProfileId)
    .eq("resume_id", parsed.data.resume_id)
    .eq("job_id", parsed.data.job_id)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return successWithRedirect(
      "You already analyzed this resume against this job — opening the existing report.",
      `/matches/${existing.id}`
    );
  }

  // Per decision 0012, analysis now runs in the backend. The web creates the
  // match shell so the analyze endpoint (path param :matchId) has a subject to
  // fill in; the backend overwrites these placeholder scores with the AI result.
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      user_id: context.userProfileId,
      resume_id: parsed.data.resume_id,
      job_id: parsed.data.job_id,
      overall_score: 0,
      skill_score: 0,
      experience_score: 0,
      ai_readiness_score: 0,
      ats_keyword_score: 0,
      seniority_score: 0,
    })
    .select("id")
    .single();

  if (matchError || !match?.id) {
    // Race backstop: the unique (user, resume, job) index rejects a concurrent
    // duplicate insert; open the existing report instead of erroring.
    if (matchError?.code === "23505") {
      const { data: raced } = await supabase
        .from("matches")
        .select("id")
        .eq("user_id", context.userProfileId)
        .eq("resume_id", parsed.data.resume_id)
        .eq("job_id", parsed.data.job_id)
        .limit(1)
        .maybeSingle();
      if (raced?.id) {
        return successWithRedirect(
          "You already analyzed this resume against this job — opening the existing report.",
          `/matches/${raced.id}`
        );
      }
    }
    return failure("Match analysis save failed. Confirm the Period 2 matches schema exists.");
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await runMatchAnalysis({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    matchId: match.id,
    sessionToken,
  });

  if (!result.ok) {
    // Remove the shell so the matches list never shows a half-finished analysis.
    await supabase
      .from("matches")
      .delete()
      .eq("id", match.id)
      .eq("user_id", context.userProfileId);
    return failure(result.message ?? "Match analysis failed.");
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

export async function regenerateMatchAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateMatchIdInput(readForm(formData));
  if (!parsed.success) {
    return failure(
      "A match is required to regenerate analysis.",
      getValidationFieldErrors(parsed.error)
    );
  }

  const supabase = getSupabaseServiceClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select("id,job_id")
    .eq("id", parsed.data.match_id)
    .eq("user_id", context.userProfileId)
    .single();

  if (error || !match?.id) {
    return failure("Unable to load that match for this account.");
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await runMatchAnalysis({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    matchId: match.id,
    sessionToken,
    regenerate: true,
  });

  if (!result.ok) {
    return failure(result.message ?? "Match analysis regeneration failed.");
  }

  revalidatePath(`/matches/${match.id}`);
  revalidatePath("/matches");
  if (match.job_id) {
    revalidatePath(`/jobs/${match.job_id}`);
  }
  revalidatePath("/dashboard");

  return success("Match analysis regenerated.");
}

async function runMatchSubWorkflowAction(
  formData: FormData,
  options: {
    segment: string;
    successMessage: string;
    failureMessage: string;
    extraPaths?: (matchId: string) => string[];
  }
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const parsed = validateMatchIdInput(readForm(formData));
  if (!parsed.success) {
    return failure(
      "A match is required for this step.",
      getValidationFieldErrors(parsed.error)
    );
  }

  const supabase = getSupabaseServiceClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select("id,job_id")
    .eq("id", parsed.data.match_id)
    .eq("user_id", context.userProfileId)
    .single();

  if (error || !match?.id) {
    return failure("Unable to load that match for this account.");
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await runMatchSubWorkflow({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    matchId: match.id,
    segment: options.segment,
    sessionToken,
  });

  if (!result.ok) {
    return failure(result.message ?? options.failureMessage);
  }

  revalidatePath(`/matches/${match.id}`);
  for (const path of options.extraPaths?.(match.id) ?? []) {
    revalidatePath(path);
  }
  if (match.job_id) {
    revalidatePath(`/jobs/${match.job_id}`);
  }
  revalidatePath("/dashboard");

  return success(options.successMessage);
}

export async function generateMissingSkillsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runMatchSubWorkflowAction(formData, {
    segment: "missing-skills",
    successMessage: "Skill gap analysis generated.",
    failureMessage: "Skill gap analysis failed.",
    extraPaths: (matchId) => [`/matches/${matchId}/gaps`],
  });
}

export async function generateAssistantInsightAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runMatchSubWorkflowAction(formData, {
    segment: "assistant-insight",
    successMessage: "Assistant insight generated.",
    failureMessage: "Assistant insight failed.",
  });
}

export async function generateResumeSuggestionsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Per decision 0012, generation now runs the US-031 backend workflow (Gemini +
  // deterministic fallback, Truth Guard) instead of the inline deterministic path.
  return runMatchSubWorkflowAction(formData, {
    segment: "resume-suggestions",
    successMessage: "Resume suggestions generated.",
    failureMessage: "Resume suggestions failed.",
    extraPaths: (matchId) => [`/matches/${matchId}/resume-suggestions`],
  });
}

export async function updateSuggestionAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const raw = readForm(formData);
  const suggestionId = typeof raw.suggestion_id === "string" ? raw.suggestion_id : "";
  const matchId = typeof raw.match_id === "string" ? raw.match_id : "";
  const userAction = typeof raw.user_action === "string" ? raw.user_action : "";
  const editedText = typeof raw.suggested_text === "string" ? raw.suggested_text.trim() : "";

  if (!suggestionId || !["accepted", "rejected", "pending"].includes(userAction)) {
    return failure("Invalid suggestion update.");
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await patchResumeSuggestion({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    suggestionId,
    sessionToken,
    userAction,
    // Only send edited text on accept, when the user actually changed it.
    suggestedText: userAction === "accepted" && editedText ? editedText : null,
  });

  if (!result.ok) {
    return failure(result.message ?? "Could not update the suggestion.");
  }

  if (matchId) {
    revalidatePath(`/matches/${matchId}/resume-suggestions`);
  }

  const label =
    userAction === "accepted"
      ? "Suggestion accepted."
      : userAction === "rejected"
        ? "Suggestion rejected."
        : "Suggestion reset.";
  return success(label);
}

export async function generateResumeDraftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Per decision 0012, the draft is now generated by the US-032 backend workflow
  // (Gemini + deterministic fallback) which excludes unsupported suggestions and
  // saves a resume_versions row.
  return runMatchSubWorkflowAction(formData, {
    segment: "tailored-resume",
    successMessage: "Markdown resume draft generated.",
    failureMessage: "Resume draft generation failed.",
    extraPaths: (matchId) => [`/matches/${matchId}/resume-draft`],
  });
}

export async function generateCoverLetterAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runMatchSubWorkflowAction(formData, {
    segment: "cover-letter",
    successMessage: "Cover letter generated.",
    failureMessage: "Cover letter generation failed.",
    extraPaths: (matchId) => [`/matches/${matchId}/cover-letter`],
  });
}

export async function generateRoadmapAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Per decision 0012, the roadmap is now generated by the US-034 backend
  // workflow (Gemini + deterministic fallback) which upserts the roadmaps row.
  return runMatchSubWorkflowAction(formData, {
    segment: "roadmap",
    successMessage: "4-week roadmap generated.",
    failureMessage: "Roadmap generation failed.",
    extraPaths: (matchId) => [`/matches/${matchId}/roadmap`],
  });
}

export async function generateDashboardSummaryAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // US-036: the cross-job summary is generated by the backend workflow and
  // persisted to dashboard_ai_summary (one live row per user).
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const regenerate = formData.get("regenerate") === "true";
  const sessionToken = await getCurrentSessionToken();

  try {
    await runWorkflow({
      apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
      path: regenerate
        ? "/api/dashboard/ai-summary/regenerate"
        : "/api/dashboard/ai-summary",
      sessionToken,
    });
  } catch (error) {
    if (error instanceof AIWorkflowError) {
      return failure(error.message);
    }
    return failure("Job search summary generation failed.");
  }

  revalidatePath("/dashboard");
  return success(
    regenerate ? "Job search summary regenerated." : "Job search summary generated."
  );
}

export async function runFullWorkflowAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // US-038: sequential orchestration of every AI panel step for a match.
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const matchId = formData.get("match_id");
  if (typeof matchId !== "string" || !matchId) {
    return failure("A match is required.");
  }
  const force = formData.get("force") === "true";

  const sessionToken = await getCurrentSessionToken();
  const result = await runFullWorkflow({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    matchId,
    sessionToken,
    force,
  });

  if (!result.ok) {
    return failure(result.message ?? "The full AI workflow failed to start.");
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/tracker");
  revalidatePath("/dashboard");

  if (result.status === "complete") {
    return success(
      result.applicationStatus === "prepared"
        ? "All AI steps completed — application marked Prepared."
        : "All AI steps completed."
    );
  }
  return failure(
    `${result.stepsCompleted} step(s) completed, but ${result.failedStep ?? "a step"} failed` +
      ` and ${result.stepsBlocked} step(s) were skipped. Retry the failed step to continue.`
  );
}

export async function regenerateWorkflowStepAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // US-038: per-step Regenerate / Retry from the AI workflow panel.
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const matchId = formData.get("match_id");
  const step = formData.get("step");
  if (typeof matchId !== "string" || !matchId || typeof step !== "string" || !step) {
    return failure("A match and step are required.");
  }

  const result = await runMatchSubWorkflow({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    matchId,
    segment: `ai-workflow/${step}`,
    sessionToken: await getCurrentSessionToken(),
    regenerate: true,
  });

  if (!result.ok) {
    return failure(result.message ?? "The step could not be regenerated.");
  }

  revalidatePath(`/matches/${matchId}`);
  return success("Step regenerated.");
}

export async function regenerateActivityDescriptionAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // US-037: per-item refresh of the assistant description; the original text
  // is preserved server-side when regeneration fails.
  const context = await requireWritableContext();
  if (!context.ok) {
    return failure(context.message);
  }

  const activityId = formData.get("activity_id");
  if (typeof activityId !== "string" || !activityId) {
    return failure("An activity is required.");
  }

  const sessionToken = await getCurrentSessionToken();
  const result = await regenerateActivityDescription({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    activityId,
    sessionToken,
  });

  if (!result.ok) {
    return failure(result.message ?? "Could not refresh the description.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  return success("Activity description refreshed.");
}

export async function generateInterviewPrepAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Per decision 0012, interview prep is now generated by the US-035 backend
  // workflow (Gemini + deterministic fallback) which upserts interview_preps.
  return runMatchSubWorkflowAction(formData, {
    segment: "interview-prep",
    successMessage: "Interview prep generated.",
    failureMessage: "Interview prep generation failed.",
    extraPaths: (matchId) => [`/matches/${matchId}/interview-prep`],
  });
}
