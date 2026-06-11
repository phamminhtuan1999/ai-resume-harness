import "server-only";

import { cache } from "react";

import { notFound } from "next/navigation";

import { fetchAnalysisHistory, fetchAnalysisPackage } from "@/lib/ai-workflow-client.mjs";
import { summarizeApplicationStatuses } from "@/lib/application-tracker.mjs";
import {
  getCurrentAppUser,
  getCurrentSessionToken,
  isPreviewAuth,
  type AppUser,
} from "@/lib/auth/server";
import { hasSupabaseEnv, serverEnv } from "@/lib/env";
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
  // Period 8 AI analysis columns (US-028, migration 0011). Optional: matches
  // created before the analyzer ran (or by older queries) will not carry them.
  apply_recommendation?: string | null;
  assistant_summary?: string | null;
  fit_reasoning?: string | null;
  score_explanations_json?: unknown;
  top_strengths_json?: unknown;
  top_gaps_json?: unknown;
  next_best_action?: string | null;
  seniority_match_label?: string | null;
  location_score?: number | null;
  confidence_score?: number | null;
  analyzer_provider?: string | null;
  // When the analysis was generated (migration 0015), for staleness detection.
  analyzed_at?: string | null;
  // Derived: true when the resume or job changed after analyzed_at. Set by the
  // data readers, not a DB column.
  is_stale?: boolean;
  // US-053: the latest decision snapshot for this match (newest analysis_decisions
  // row), so the list badge speaks the same vocabulary as the detail page. Null
  // for never-recomputed matches (caller falls back to the legacy badge).
  decision?: { label: DecisionLabel; match_score: number | null } | null;
  created_at: string;
  updated_at: string;
  resumes: {
    id: string;
    title: string;
    updated_at?: string | null;
  } | null;
  jobs: {
    id: string;
    company: string;
    title: string;
    updated_at?: string | null;
  } | null;
};

// True when the resume or job was edited after the analysis was generated.
// Timestamp-based (Option A): bumping any job field marks it stale even if the
// analyzed text did not change — acceptable tradeoff vs a content hash.
export function isMatchStale(row: {
  analyzed_at?: string | null;
  resumes?: { updated_at?: string | null } | null;
  jobs?: { updated_at?: string | null } | null;
}): boolean {
  if (!row.analyzed_at) {
    return false;
  }
  const analyzed = new Date(row.analyzed_at).getTime();
  const resumeAt = row.resumes?.updated_at ? new Date(row.resumes.updated_at).getTime() : 0;
  const jobAt = row.jobs?.updated_at ? new Date(row.jobs.updated_at).getTime() : 0;
  return resumeAt > analyzed || jobAt > analyzed;
}

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

export type MissingSkillAnalysis = {
  id: string;
  match_id: string;
  summary: string | null;
  missing_skills_json: unknown;
  top_3_priority_gaps_json: unknown;
  confidence_score: number | null;
  provider: string | null;
  updated_at: string;
};

export type AssistantInsight = {
  id: string;
  match_id: string;
  assistant_summary: string | null;
  recommendation: string | null;
  why_this_recommendation: string | null;
  next_best_action: string | null;
  application_strategy: string | null;
  risk_level: string | null;
  confidence_score: number | null;
  provider: string | null;
  updated_at: string;
};

export type CoverLetter = {
  id: string;
  match_id: string;
  job_id: string | null;
  cover_letter: string | null;
  cover_letter_strategy: string | null;
  key_points_json: unknown;
  claims_avoided_json: unknown;
  tone: string | null;
  confidence_score: number | null;
  provider: string | null;
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

const ASSISTANT_INSIGHT_COLUMNS =
  "id,match_id,assistant_summary,recommendation,why_this_recommendation," +
  "next_best_action,application_strategy,risk_level,confidence_score,provider,updated_at";

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

export async function getWorkspaceProfile() {
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

  // The imported candidate profile (US-019) is account-level; surface it on
  // the resume page so the parsed view, not raw text, is the primary detail.
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("candidate_profile_json")
    .eq("id", profile.id)
    .maybeSingle();

  return {
    appUser,
    profile,
    resume: resumeRow as unknown as WorkspaceResume & {
      source_file_name: string | null;
      source_mime_type: string | null;
      source_size_bytes: number | null;
      import_error: string | null;
    },
    candidateProfile:
      (profileRow as { candidate_profile_json?: unknown } | null)
        ?.candidate_profile_json ?? null,
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
        "employment_type",
        "salary_range",
        "raw_description",
        "structured_json",
        "extraction_json",
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

export async function getMatchesList() {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    return { appUser, profile: null, matches: [] as WorkspaceMatch[] };
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "resume_id",
        "job_id",
        "overall_score",
        "apply_recommendation",
        "assistant_summary",
        "confidence_score",
        "analyzer_provider",
        "analyzed_at",
        "created_at",
        "updated_at",
        "resumes(id,title,updated_at)",
        "jobs(id,company,title,updated_at)",
      ].join(",")
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[ApplyWise data skipped] Unable to load matches list.");
  }

  const rows = (data ?? []) as unknown as WorkspaceMatch[];

  // Batch-read the latest decision snapshot per match (US-053) so each list row
  // shows the decision badge + match % in the detail page's vocabulary. One
  // query ordered newest-first; the first row seen per match_id is the latest.
  const latestDecisionByMatch = new Map<string, { label: DecisionLabel; match_score: number | null }>();
  const matchIds = rows.map((match) => match.id);
  if (matchIds.length > 0) {
    const { data: snapshots, error: snapshotError } = await supabase
      .from("analysis_decisions")
      .select("match_id,label,match_score,decided_at")
      .eq("user_id", profile.id)
      .in("match_id", matchIds)
      .order("decided_at", { ascending: false });

    if (snapshotError) {
      console.warn("[ApplyWise data skipped] Unable to load decision snapshots for the list.");
    }

    for (const snapshot of (snapshots ?? []) as unknown as Array<{
      match_id: string;
      label: DecisionLabel;
      match_score: number | null;
    }>) {
      if (!latestDecisionByMatch.has(snapshot.match_id)) {
        latestDecisionByMatch.set(snapshot.match_id, {
          label: snapshot.label,
          match_score: snapshot.match_score,
        });
      }
    }
  }

  const matches = rows.map((match) => ({
    ...match,
    is_stale: isMatchStale(match),
    decision: latestDecisionByMatch.get(match.id) ?? null,
  }));

  return { appUser, profile, matches };
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
  const [{ data: matchRow, error }, { data: insightRow, error: insightError }] = await Promise.all([
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
          "apply_recommendation",
          "assistant_summary",
          "fit_reasoning",
          "score_explanations_json",
          "top_strengths_json",
          "top_gaps_json",
          "next_best_action",
          "seniority_match_label",
          "location_score",
          "confidence_score",
          "analyzer_provider",
          "analyzed_at",
          "created_at",
          "updated_at",
          "resumes(id,title,updated_at)",
          "jobs(id,company,title,updated_at)",
        ].join(",")
      )
      .eq("id", matchId)
      .eq("user_id", profile.id)
      .single(),
    supabase
      .from("assistant_insights")
      .select(ASSISTANT_INSIGHT_COLUMNS)
      .eq("match_id", matchId)
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  if (error || !matchRow) {
    notFound();
  }

  if (insightError) {
    console.warn("[ApplyWise data skipped] Unable to load assistant insight.");
  }

  const match = matchRow as unknown as WorkspaceMatch;

  return {
    appUser,
    profile,
    match: { ...match, is_stale: isMatchStale(match) },
    insight: (insightRow ?? null) as AssistantInsight | null,
  };
}

export type DecisionLabel =
  | "strong_apply"
  | "apply_with_improvements"
  | "learning_target"
  | "not_recommended";

export type AnalysisPackageDecision = {
  label: DecisionLabel;
  display_label: string;
  match_score: number;
  risk_level: "low" | "medium" | "high";
  summary: string;
  confidence: { score: number | null; qualitative: string; reasons: string[] };
  previous: { label: DecisionLabel; decided_at: string | null } | null;
};

export type AnalysisPackage = {
  version: string;
  rules_version: string;
  analysis_state: "not_analyzed" | "partial" | "complete" | "stale";
  stale: boolean;
  analyzed_at: string | null;
  job: {
    id: string | null;
    title: string;
    company: string;
    location: string | null;
    work_type: string | null;
    job_url: string | null;
  };
  resume: { id: string | null; title: string | null };
  application: { status: string | null; applied_date: string | null } | null;
  decision: AnalysisPackageDecision | null;
  scores: {
    overall: number;
    skill: number;
    experience: number;
    ai_readiness: number;
    ats_keywords: number;
    seniority: number;
  };
  evidence: {
    matched: { label: string; detail: string }[];
    missing: string[];
    risks: string[];
  };
  skill_gaps: {
    skill: string;
    importance: string;
    gap_type: string;
    evidence_status: string;
    why_it_matters: string;
    how_to_fix: string;
    interview_risk: string;
  }[];
  next_actions: {
    type: string;
    label: string;
    priority: number;
    reason: string;
    placement: string;
    state: string;
  }[];
  material_readiness: { draft_cv: string; cover_letter: string; reason: string } | null;
  analysis_details: {
    model_provider: string | null;
    model_name: string | null;
    last_run_at: string | null;
    steps: {
      workflow_type: string;
      status: string;
      model_provider: string | null;
      model_name: string | null;
      completed_at: string | null;
    }[];
  };
};

export type AnalysisPackageResult =
  | { ok: true; package: AnalysisPackage }
  | { ok: false; message: string };

// The decision-first overview (US-048) consumes the one US-047 composition
// endpoint rather than re-stitching module rows. This is a server-side GET to
// the FastAPI backend (pattern: fetchActivityFeed), not a direct Supabase read,
// because the decision label + presentation are computed server-side only.
// Wrapped in React `cache` so the match layout (tab shell + emphasis) and the
// page that renders inside it dedupe to a single backend fetch per request
// (US-051 — the layout reads the decision label for tab emphasis).
export const getAnalysisPackage = cache(
  async (matchId: string): Promise<AnalysisPackageResult> => {
    const sessionToken = await getCurrentSessionToken();
    const result = await fetchAnalysisPackage({
      apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
      matchId,
      sessionToken,
      preview: isPreviewAuth(),
    });
    if (!result.ok) {
      return { ok: false, message: result.message ?? "Unable to load the analysis." };
    }
    return { ok: true, package: result.package as AnalysisPackage };
  }
);

// US-054 decision history (read-only). Snapshots newest-first, capped, with the
// dropped count surfaced. Rendered only inside the Advanced tab.
export type DecisionHistoryEntry = {
  id: string | null;
  label: DecisionLabel;
  display_label: string;
  match_score: number | null;
  risk_level: "low" | "medium" | "high" | null;
  confidence: number | null;
  summary: string;
  previous_label: DecisionLabel | null;
  rules_version: string;
  decided_at: string | null;
  inputs: {
    resume_updated_at: string | null;
    job_updated_at: string | null;
    profile_updated_at: string | null;
  };
};

export type AnalysisDecisionHistory = {
  version: string;
  match_id: string;
  returned: number;
  total: number;
  dropped: number;
  entries: DecisionHistoryEntry[];
};

export type AnalysisHistoryResult =
  | { ok: true; history: AnalysisDecisionHistory }
  | { ok: false; message: string };

export async function getAnalysisHistory(matchId: string): Promise<AnalysisHistoryResult> {
  const sessionToken = await getCurrentSessionToken();
  const result = await fetchAnalysisHistory({
    apiBaseUrl: serverEnv.NEXT_PUBLIC_API_BASE_URL,
    matchId,
    sessionToken,
    preview: isPreviewAuth(),
  });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Unable to load the history." };
  }
  return { ok: true, history: result.history as AnalysisDecisionHistory };
}

export async function getMissingSkillsDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: matchRow, error: matchError }, { data: analysisRow, error: analysisError }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          [
            "id",
            "resume_id",
            "job_id",
            "overall_score",
            "apply_recommendation",
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
        .from("missing_skill_analyses")
        .select(
          "id,match_id,summary,missing_skills_json,top_3_priority_gaps_json," +
            "confidence_score,provider,updated_at"
        )
        .eq("match_id", matchId)
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (analysisError) {
    console.warn("[ApplyWise data skipped] Unable to load missing skill analysis.");
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    analysis: (analysisRow ?? null) as MissingSkillAnalysis | null,
  };
}

export async function getCoverLetterDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: matchRow, error: matchError }, { data: letterRow, error: letterError }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          [
            "id",
            "resume_id",
            "job_id",
            "overall_score",
            "apply_recommendation",
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
        .from("cover_letters")
        .select(
          "id,match_id,job_id,cover_letter,cover_letter_strategy,key_points_json," +
            "claims_avoided_json,tone,confidence_score,provider,updated_at"
        )
        .eq("match_id", matchId)
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (letterError) {
    console.warn("[ApplyWise data skipped] Unable to load cover letter.");
  }

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    coverLetter: (letterRow ?? null) as CoverLetter | null,
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
    { data: runRow },
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
    supabase
      .from("ai_workflow_runs")
      .select("output_snapshot_json")
      .eq("user_id", profile.id)
      .eq("subject_type", "match")
      .eq("subject_id", matchId)
      .eq("workflow_type", "resume_suggestions")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (suggestionsError) {
    console.warn("[ApplyWise data skipped] Unable to load resume suggestions.");
  }

  const snapshot =
    ((runRow as { output_snapshot_json?: unknown } | null)?.output_snapshot_json ?? null) as
      | Record<string, unknown>
      | null;

  return {
    appUser,
    profile,
    match: matchRow as unknown as WorkspaceMatch,
    suggestions: (suggestionRows ?? []) as unknown as ResumeSuggestion[],
    snapshot,
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

export type DraftCvMatch = {
  id: string;
  resume_id: string | null;
  job_id: string | null;
  apply_recommendation: string | null;
  analyzed_at: string | null;
  jobs?: { id: string; company: string | null; title: string | null } | null;
  resumes?: { id: string; title: string | null } | null;
};

export type DraftCvRecord = {
  id: string;
  match_id: string;
  job_id: string | null;
  resume_id: string | null;
  version: number;
  title: string;
  status: string;
  cv_json: Record<string, unknown>;
  cv_strategy_json: Record<string, unknown> | null;
  quality_notes_json: Array<{ code: string; detail: string }> | null;
  confidence_score: number | null;
  provider: string | null;
  last_exported_pdf_at: string | null;
  last_exported_docx_at: string | null;
  rendering_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export async function getDraftCvDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [
    { data: matchRow, error: matchError },
    { data: draftRows, error: draftsError },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        [
          "id",
          "resume_id",
          "job_id",
          "overall_score",
          "apply_recommendation",
          "analyzed_at",
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
      .from("draft_cvs")
      .select(
        [
          "id",
          "match_id",
          "job_id",
          "resume_id",
          "version",
          "title",
          "status",
          "cv_json",
          "cv_strategy_json",
          "quality_notes_json",
          "confidence_score",
          "provider",
          "last_exported_pdf_at",
          "last_exported_docx_at",
          "rendering_json",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("match_id", matchId)
      .eq("user_id", profile.id)
      .order("version", { ascending: false }),
  ]);

  if (matchError || !matchRow) {
    notFound();
  }

  if (draftsError) {
    console.warn("[ApplyWise data skipped] Unable to load draft CVs.");
  }

  const versions = (draftRows ?? []) as unknown as DraftCvRecord[];

  return {
    appUser,
    profile,
    match: matchRow as unknown as DraftCvMatch,
    draft: versions[0] ?? null,
    versions,
  };
}

export async function getRoadmapDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [
    { data: matchRow, error: matchError },
    { data: roadmapRows, error: roadmapsError },
    { data: gapRow },
    { data: roadmapRunRow },
  ] = await Promise.all([
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
    // Dependency guard (US-034): the roadmap needs a missing-skill analysis.
    supabase
      .from("missing_skill_analyses")
      .select("id")
      .eq("match_id", matchId)
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("ai_workflow_runs")
      .select("status,model_provider,confidence_score,completed_at")
      .eq("user_id", profile.id)
      .eq("subject_type", "match")
      .eq("subject_id", matchId)
      .eq("workflow_type", "roadmap")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    hasGapAnalysis: Boolean(gapRow?.id),
    roadmapRun: (roadmapRunRow ?? null) as {
      status: string;
      model_provider: string | null;
      confidence_score: number | null;
      completed_at: string | null;
    } | null,
  };
}

export async function getInterviewPrepDetail(matchId: string) {
  const { appUser, profile } = await getWorkspaceProfile();

  if (!profile) {
    notFound();
  }

  const supabase = getSupabaseServiceClient();
  const [
    { data: matchRow, error: matchError },
    { data: prepRows, error: prepsError },
    { data: prepRunRow },
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
    supabase
      .from("ai_workflow_runs")
      .select("status,model_provider,confidence_score,completed_at")
      .eq("user_id", profile.id)
      .eq("subject_type", "match")
      .eq("subject_id", matchId)
      .eq("workflow_type", "interview_prep")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    prepRun: (prepRunRow ?? null) as {
      status: string;
      model_provider: string | null;
      confidence_score: number | null;
      completed_at: string | null;
    } | null,
  };
}

export async function getMatchAiWorkflowRuns(matchId: string) {
  const { profile } = await getWorkspaceProfile();

  if (!profile) {
    return { runs: [], profileReady: false, jobImported: false, jobParsed: false };
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: runRows }, { data: matchRow }, { data: profileRow }] =
    await Promise.all([
      supabase
        .from("ai_workflow_runs")
        .select(
          [
            "workflow_type",
            "status",
            "model_provider",
            "model_name",
            "confidence_score",
            "completed_at",
            "created_at",
            "output_snapshot_json",
            "error_code",
            "error_message",
          ].join(",")
        )
        .eq("user_id", profile.id)
        .eq("subject_type", "match")
        .eq("subject_id", matchId)
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select("id,job_id,jobs(id,parse_status,raw_description)")
        .eq("id", matchId)
        .eq("user_id", profile.id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("candidate_profile_json,current_role,target_role")
        .eq("id", profile.id)
        .maybeSingle(),
    ]);

  const job = (matchRow as { jobs?: { parse_status?: string; raw_description?: string } } | null)
    ?.jobs;
  const profileData = profileRow as {
    candidate_profile_json?: unknown;
    current_role?: string | null;
    target_role?: string | null;
  } | null;

  return {
    runs: (runRows ?? []) as unknown as Record<string, unknown>[],
    profileReady: Boolean(
      profileData?.candidate_profile_json ||
        profileData?.current_role ||
        profileData?.target_role
    ),
    jobImported: Boolean(job?.raw_description),
    jobParsed: job?.parse_status === "parsed",
  };
}

export async function getActivityFeedPage(offset = 0, pageSize = 20) {
  const { profile } = await getWorkspaceProfile();

  if (!profile) {
    return { rows: [] as Record<string, unknown>[], total: 0 };
  }

  const supabase = getSupabaseServiceClient();
  const { data: rows, error, count } = await supabase
    .from("activity_feed")
    .select(
      [
        "id",
        "activity_type",
        "title",
        "assistant_description",
        "importance",
        "created_at",
        "related_job_id",
        "related_job:jobs(id,title,company)",
      ].join(","),
      { count: "exact" }
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.warn("[ApplyWise data skipped] Unable to load recent activity.");
    return { rows: [] as Record<string, unknown>[], total: 0 };
  }

  return {
    rows: (rows ?? []) as unknown as Record<string, unknown>[],
    total: count ?? 0,
  };
}

export async function getDashboardAiSummary() {
  const { profile } = await getWorkspaceProfile();

  if (!profile) {
    return { hasEnoughData: false, summary: null, run: null };
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: analyzedRuns }, { data: summaryRow }, { data: runRow }] =
    await Promise.all([
      // US-036 data gate: completed match/gap analyses across all jobs.
      supabase
        .from("ai_workflow_runs")
        .select("id")
        .eq("user_id", profile.id)
        .in("workflow_type", ["match_analysis", "missing_skills"])
        .eq("status", "completed"),
      supabase
        .from("dashboard_ai_summary")
        .select(
          [
            "id",
            "dashboard_summary",
            "best_fit_roles_json",
            "repeated_skill_gaps_json",
            "job_search_health",
            "recommended_next_actions_json",
            "confidence_score",
            "provider",
            "updated_at",
          ].join(",")
        )
        .eq("user_id", profile.id)
        .maybeSingle(),
      supabase
        .from("ai_workflow_runs")
        .select("status,model_provider,confidence_score,completed_at")
        .eq("user_id", profile.id)
        .eq("workflow_type", "dashboard_summary")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    hasEnoughData: (analyzedRuns?.length ?? 0) >= 3,
    summary: (summaryRow ?? null) as Record<string, unknown> | null,
    run: (runRow ?? null) as {
      status: string;
      model_provider: string | null;
      confidence_score: number | null;
      completed_at: string | null;
    } | null,
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
