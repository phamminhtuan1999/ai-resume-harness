import "server-only";

import { notFound } from "next/navigation";

import { summarizeApplicationStatuses } from "@/lib/application-tracker.mjs";
import { getCurrentAppUser, type AppUser } from "@/lib/auth/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type WorkspaceProfile = {
  id: string;
  email: string;
  full_name: string | null;
  current_role: string | null;
  years_of_experience: number | null;
  target_role: string | null;
  location_preference: string | null;
  technical_background: string | null;
};

export type WorkspaceResume = {
  id: string;
  title: string;
  raw_text: string;
  source_type: string;
  import_status: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceJob = {
  id: string;
  company: string;
  title: string;
  job_url: string | null;
  location: string | null;
  parse_status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_linkedin_url: string | null;
  contact_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMatch = {
  id: string;
  resume_id: string;
  job_id: string;
  overall_score: number;
  skill_score: number;
  experience_score: number;
  ai_readiness_score: number;
  ats_keyword_score: number;
  seniority_score: number;
  strengths_json: unknown;
  weaknesses_json: unknown;
  missing_skills_json: unknown;
  risks_json: unknown;
  explanation_json: unknown;
  created_at: string;
  updated_at: string;
  resumes: {
    id: string;
    title: string;
  } | null;
  jobs: {
    id: string;
    company: string;
    title: string;
  } | null;
};

export type ApplicationTrackerItem = {
  id: string;
  user_id: string;
  job_id: string;
  match_id: string | null;
  status: string;
  applied_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  jobs: {
    id: string;
    company: string;
    title: string;
    job_url: string | null;
    location: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_linkedin_url: string | null;
    contact_notes: string | null;
  } | null;
  matches: {
    id: string;
    overall_score: number;
  } | null;
};

export type TrackerData = {
  appUser: AppUser | null;
  profile: WorkspaceProfile | null;
  applications: ApplicationTrackerItem[];
  statusSummary: Record<string, number>;
  isConfigured: boolean;
};

export type ResumeSuggestion = {
  id: string;
  match_id: string;
  original_text: string | null;
  suggested_text: string;
  suggestion_type: string | null;
  related_job_requirement: string | null;
  evidence: string | null;
  truth_guard_status: string;
  reason: string | null;
  user_action: string;
  created_at: string;
  updated_at: string;
};

export type ResumeVersion = {
  id: string;
  user_id: string;
  resume_id: string;
  job_id: string;
  match_id: string;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
};

export type Roadmap = {
  id: string;
  user_id: string;
  match_id: string;
  title: string;
  roadmap_json: unknown;
  created_at: string;
  updated_at: string;
};

export type InterviewPrep = {
  id: string;
  user_id: string;
  match_id: string;
  questions_json: unknown;
  weak_topics_json: unknown;
  study_plan_json: unknown;
  answer_guidance_json: unknown;
  created_at: string;
  updated_at: string;
};

export type WorkspaceData = {
  appUser: AppUser | null;
  profile: WorkspaceProfile | null;
  resumes: WorkspaceResume[];
  jobs: WorkspaceJob[];
  matches: WorkspaceMatch[];
  isConfigured: boolean;
};

export async function getWorkspaceData(): Promise<WorkspaceData> {
  const appUser = await getCurrentAppUser();

  if (!appUser || !hasSupabaseEnv()) {
    return {
      appUser,
      profile: null,
      resumes: [],
      jobs: [],
      matches: [],
      isConfigured: Boolean(appUser && hasSupabaseEnv()),
    };
  }

  const supabase = getSupabaseServiceClient();
  const { data: profileRow, error: profileError } = await supabase
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
    .select(
      [
        "id",
        "email",
        "full_name",
        "current_role",
        "years_of_experience",
        "target_role",
        "location_preference",
        "technical_background",
      ].join(",")
    )
    .single();
  const profile = profileRow as unknown as WorkspaceProfile | null;

  if (profileError || !profile?.id) {
    console.warn("[ApplyWise data skipped] Unable to load workspace profile.");
    return {
      appUser,
      profile: null,
      resumes: [],
      jobs: [],
      matches: [],
      isConfigured: true,
    };
  }

  const [
    { data: resumeRows, error: resumesError },
    { data: jobRows, error: jobsError },
    { data: matchRows, error: matchesError },
  ] = await Promise.all([
      supabase
        .from("resumes")
        .select("id,title,raw_text,source_type,import_status,created_at,updated_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("jobs")
        .select(
          [
            "id",
            "company",
            "title",
            "job_url",
            "location",
            "parse_status",
            "contact_name",
            "contact_email",
            "contact_linkedin_url",
            "contact_notes",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("matches")
        .select(
          [
            "id",
            "resume_id",
            "job_id",
            "overall_score",
            "skill_score",
            "experience_score",
            "ai_readiness_score",
            "ats_keyword_score",
            "seniority_score",
            "strengths_json",
            "weaknesses_json",
            "missing_skills_json",
            "risks_json",
            "explanation_json",
            "created_at",
            "updated_at",
            "resumes(id,title)",
            "jobs(id,company,title)",
          ].join(",")
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (resumesError) {
    console.warn("[ApplyWise data skipped] Unable to load resumes.");
  }

  if (jobsError) {
    console.warn("[ApplyWise data skipped] Unable to load jobs.");
  }

  if (matchesError) {
    console.warn("[ApplyWise data skipped] Unable to load matches.");
  }

  return {
    appUser,
    profile,
    resumes: (resumeRows ?? []) as unknown as WorkspaceResume[],
    jobs: (jobRows ?? []) as unknown as WorkspaceJob[],
    matches: (matchRows ?? []) as unknown as WorkspaceMatch[],
    isConfigured: true,
  };
}

async function getWorkspaceProfile() {
  const appUser = await getCurrentAppUser();

  if (!appUser || !hasSupabaseEnv()) {
    return { appUser, profile: null };
  }

  const supabase = getSupabaseServiceClient();
  const { data: profileRow, error } = await supabase
    .from("user_profiles")
    .select(
      [
        "id",
        "email",
        "full_name",
        "current_role",
        "years_of_experience",
        "target_role",
        "location_preference",
        "technical_background",
      ].join(",")
    )
    .eq("clerk_user_id", appUser.clerkUserId)
    .single();

  if (error || !profileRow) {
    return { appUser, profile: null };
  }

  return {
    appUser,
    profile: profileRow as unknown as WorkspaceProfile,
  };
}

export async function getResumeDetail(resumeId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const { data: resumeRow, error } = await supabase
    .from("resumes")
    .select(
      [
        "id",
        "title",
        "raw_text",
        "source_type",
        "source_file_name",
        "source_mime_type",
        "source_size_bytes",
        "import_status",
        "import_error",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("id", resumeId)
    .eq("user_id", profile.id)
    .single();

  if (error || !resumeRow) {
    notFound();
  }

  return {
    appUser,
    profile,
    resume: resumeRow as unknown as WorkspaceResume & {
      source_file_name: string | null;
      source_mime_type: string | null;
      source_size_bytes: number | null;
      import_error: string | null;
    },
  };
}

export async function getJobDetail(jobId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const { data: jobRow, error } = await supabase
    .from("jobs")
    .select(
      [
        "id",
        "company",
        "title",
        "job_url",
        "location",
        "work_type",
        "raw_description",
        "parse_status",
        "contact_name",
        "contact_email",
        "contact_linkedin_url",
        "contact_notes",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("id", jobId)
    .eq("user_id", profile.id)
    .single();

  if (error || !jobRow) {
    notFound();
  }

  return {
    appUser,
    profile,
    job: jobRow as unknown as WorkspaceJob & {
      work_type: string | null;
      raw_description: string;
    },
  };
}

export async function getMatchWorkspaceData() {
  const data = await getWorkspaceData();

  return {
    appUser: data.appUser,
    profile: data.profile,
    resumes: data.resumes,
    jobs: data.jobs,
    matches: data.matches,
  };
}

export async function getTrackerData(): Promise<TrackerData> {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!appUser || !hasSupabaseEnv()) {
    return {
      appUser,
      profile,
      applications: [],
      statusSummary: summarizeApplicationStatuses([]),
      isConfigured: false,
    };
  }

  if (!profile) {
    return {
      appUser,
      profile,
      applications: [],
      statusSummary: summarizeApplicationStatuses([]),
      isConfigured: true,
    };
  }

  const supabase = getSupabaseServiceClient();
  const { data: applicationRows, error } = await supabase
    .from("applications")
    .select(
      [
        "id",
        "user_id",
        "job_id",
        "match_id",
        "status",
        "applied_date",
        "notes",
        "created_at",
        "updated_at",
        "jobs(id,company,title,job_url,location,contact_name,contact_email,contact_linkedin_url,contact_notes)",
        "matches(id,overall_score)",
      ].join(",")
    )
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[ApplyWise data skipped] Unable to load application tracker.");
  }

  const applications = (applicationRows ?? []) as unknown as ApplicationTrackerItem[];

  return {
    appUser,
    profile,
    applications,
    statusSummary: summarizeApplicationStatuses(applications),
    isConfigured: true,
  };
}

export async function getMatchDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const { data: matchRow, error } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "resume_id",
        "job_id",
        "overall_score",
        "skill_score",
        "experience_score",
        "ai_readiness_score",
        "ats_keyword_score",
        "seniority_score",
        "strengths_json",
        "weaknesses_json",
        "missing_skills_json",
        "risks_json",
        "explanation_json",
        "created_at",
        "updated_at",
        "resumes(id,title)",
        "jobs(id,company,title)",
      ].join(",")
    )
    .eq("id", matchId)
    .eq("user_id", profile.id)
    .single();

  if (error || !matchRow) {
    notFound();
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
  };
}

export async function getResumeSuggestionsDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [
    { data: matchRow, error: matchError },
    { data: suggestionRows, error: suggestionsError },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        [
          "id",
          "resume_id",
          "job_id",
          "overall_score",
          "strengths_json",
          "weaknesses_json",
          "missing_skills_json",
          "created_at",
          "updated_at",
          "resumes(id,title)",
          "jobs(id,company,title)",
        ].join(",")
      )
      .eq("id", matchId)
      .eq("user_id", profile.id)
      .single(),
    supabase
      .from("resume_suggestions")
      .select(
        [
          "id",
          "match_id",
          "original_text",
          "suggested_text",
          "suggestion_type",
          "related_job_requirement",
          "evidence",
          "truth_guard_status",
          "reason",
          "user_action",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: true }),
  ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (suggestionsError) {
    console.warn("[ApplyWise data skipped] Unable to load resume suggestions.");
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    suggestions: (suggestionRows ?? []) as unknown as ResumeSuggestion[],
  };
}

export async function getResumeDraftDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [
    { data: matchRow, error: matchError },
    { data: versionRows, error: versionsError },
    { data: suggestionRows, error: suggestionsError },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        [
          "id",
          "resume_id",
          "job_id",
          "overall_score",
          "created_at",
          "updated_at",
          "resumes(id,title)",
          "jobs(id,company,title)",
        ].join(",")
      )
      .eq("id", matchId)
      .eq("user_id", profile.id)
      .single(),
    supabase
      .from("resume_versions")
      .select(
        [
          "id",
          "user_id",
          "resume_id",
          "job_id",
          "match_id",
          "title",
          "content_markdown",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("match_id", matchId)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("resume_suggestions")
      .select("id,truth_guard_status")
      .eq("match_id", matchId),
  ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (versionsError) {
    console.warn("[ApplyWise data skipped] Unable to load resume versions.");
  }

  if (suggestionsError) {
    console.warn("[ApplyWise data skipped] Unable to load resume suggestions.");
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    versions: (versionRows ?? []) as unknown as ResumeVersion[],
    suggestionCount: suggestionRows?.length ?? 0,
  };
}

export async function getRoadmapDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: matchRow, error: matchError }, { data: roadmapRows, error: roadmapsError }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          [
            "id",
            "resume_id",
            "job_id",
            "overall_score",
            "missing_skills_json",
            "created_at",
            "updated_at",
            "resumes(id,title)",
            "jobs(id,company,title)",
          ].join(",")
        )
        .eq("id", matchId)
        .eq("user_id", profile.id)
        .single(),
      supabase
        .from("roadmaps")
        .select("id,user_id,match_id,title,roadmap_json,created_at,updated_at")
        .eq("match_id", matchId)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (roadmapsError) {
    console.warn("[ApplyWise data skipped] Unable to load roadmaps.");
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    roadmaps: (roadmapRows ?? []) as unknown as Roadmap[],
  };
}

export async function getInterviewPrepDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: matchRow, error: matchError }, { data: prepRows, error: prepsError }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          [
            "id",
            "resume_id",
            "job_id",
            "overall_score",
            "strengths_json",
            "weaknesses_json",
            "missing_skills_json",
            "risks_json",
            "created_at",
            "updated_at",
            "resumes(id,title)",
            "jobs(id,company,title)",
          ].join(",")
        )
        .eq("id", matchId)
        .eq("user_id", profile.id)
        .single(),
      supabase
        .from("interview_preps")
        .select(
          [
            "id",
            "user_id",
            "match_id",
            "questions_json",
            "weak_topics_json",
            "study_plan_json",
            "answer_guidance_json",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .eq("match_id", matchId)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (prepsError) {
    console.warn("[ApplyWise data skipped] Unable to load interview prep.");
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    interviewPreps: (prepRows ?? []) as unknown as InterviewPrep[],
  };
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function getContactLabel(job: Pick<WorkspaceJob, "contact_name" | "contact_email">) {
  return job.contact_name || job.contact_email || "No contact";
}
