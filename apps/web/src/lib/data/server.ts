import "server-only";

import { notFound } from "next/navigation";

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

export type WorkspaceData = {
  appUser: AppUser | null;
  profile: WorkspaceProfile | null;
  resumes: WorkspaceResume[];
  jobs: WorkspaceJob[];
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
      isConfigured: true,
    };
  }

  const [{ data: resumeRows, error: resumesError }, { data: jobRows, error: jobsError }] =
    await Promise.all([
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
    ]);

  if (resumesError) {
    console.warn("[ApplyWise data skipped] Unable to load resumes.");
  }

  if (jobsError) {
    console.warn("[ApplyWise data skipped] Unable to load jobs.");
  }

  return {
    appUser,
    profile,
    resumes: (resumeRows ?? []) as unknown as WorkspaceResume[],
    jobs: (jobRows ?? []) as unknown as WorkspaceJob[],
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
