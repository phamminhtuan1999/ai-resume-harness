import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role admin client for E2E seeding/teardown. Uses the same env the app
// reads (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Never ship this client to the
// browser — it bypasses RLS.
function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("E2E seed needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/web/.env).");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Fixed UUIDs so a re-run is idempotent and teardown is exact. The whole seed is
// scoped to one match owned by the signed-in test profile.
export const SEED = {
  resumeId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  matchId: "33333333-3333-4333-8333-333333333333",
};

// Resolve the test user's user_profiles.id from their Clerk user id. The app
// creates the profile row on first authenticated request, so visit a protected
// page once before calling this.
export async function resolveProfileId(clerkUserId: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw new Error(`Could not resolve test profile: ${error.message}`);
  if (!data?.id) throw new Error("Test profile not found — sign in and load /dashboard first.");
  return data.id as string;
}

// Editable career-profile columns — the ones the profile form writes.
export type ProfileEditFields = {
  current_role: string | null;
  years_of_experience: number | null;
  target_role: string | null;
  location_city: string | null;
  location_country: string | null;
  location_preference: string | null;
  contact_email: string | null;
  phone: string | null;
  technical_background: string | null;
};

const PROFILE_EDIT_COLUMNS =
  "current_role,years_of_experience,target_role,location_city,location_country," +
  "location_preference,contact_email,phone,technical_background";

// Read the editable profile fields. Used to capture the original row before a
// profile-editing test mutates it, so teardown can restore it exactly.
export async function readProfileFields(profileId: string): Promise<ProfileEditFields> {
  const { data, error } = await adminClient()
    .from("user_profiles")
    .select(PROFILE_EDIT_COLUMNS)
    .eq("id", profileId)
    .single();
  if (error) throw new Error(`Could not read test profile: ${error.message}`);
  return data as unknown as ProfileEditFields;
}

// Restore (or set) the editable profile fields, leaving no residue after an
// editing test puts the test user's profile back the way it found it.
export async function writeProfileFields(
  profileId: string,
  fields: ProfileEditFields
): Promise<void> {
  const { error } = await adminClient()
    .from("user_profiles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw new Error(`Could not restore test profile: ${error.message}`);
}

// Seed a complete, analyzed match with three decision snapshots (a label
// transition + a rules_version change) so the populated Period 11 surfaces
// render. Idempotent via upsert + fixed ids.
export async function seedAnalyzedMatch(profileId: string): Promise<{ matchId: string }> {
  const db = adminClient();

  await db
    .from("user_profiles")
    .update({
      target_role: "Applied AI Engineer",
      current_role: "Backend Engineer",
      technical_background: "Python, FastAPI, AWS, TypeScript, PostgreSQL",
      updated_at: "2026-06-09T00:00:00Z",
    })
    .eq("id", profileId);

  await db.from("resumes").upsert(
    {
      id: SEED.resumeId,
      user_id: profileId,
      title: "Backend Engineer Resume (E2E)",
      raw_text: "Backend engineer with 6 years building APIs in Python and FastAPI on AWS.",
      updated_at: "2026-06-09T00:00:00Z",
      created_at: "2026-06-09T00:00:00Z",
    },
    { onConflict: "id" }
  );

  await db.from("jobs").upsert(
    {
      id: SEED.jobId,
      user_id: profileId,
      company: "Northwind AI",
      title: "Applied AI Engineer",
      raw_description:
        "We are hiring an Applied AI Engineer to build RAG pipelines and LLM features. Requires Python, FastAPI, vector embeddings, and production LLM experience.",
      updated_at: "2026-06-09T00:00:00Z",
      created_at: "2026-06-09T00:00:00Z",
    },
    { onConflict: "id" }
  );

  await db.from("matches").upsert(
    {
      id: SEED.matchId,
      user_id: profileId,
      resume_id: SEED.resumeId,
      job_id: SEED.jobId,
      overall_score: 63,
      skill_score: 70,
      experience_score: 60,
      ai_readiness_score: 55,
      ats_keyword_score: 65,
      seniority_score: 60,
      apply_recommendation: "apply_with_improvements",
      top_strengths_json: [{ strength: "FastAPI", why_it_matters: "Core to the backend stack." }],
      risks_json: ["May be screened out for limited production LLM experience."],
      analyzed_at: "2026-06-10T13:00:00Z",
      updated_at: "2026-06-09T00:00:00Z",
      created_at: "2026-06-09T00:00:00Z",
    },
    { onConflict: "id" }
  );

  // Rebuild the snapshots cleanly each run.
  await db.from("analysis_decisions").delete().eq("match_id", SEED.matchId);
  const stamp = (profileUpdated: string) => ({
    resume: { id: SEED.resumeId, updated_at: "2026-06-09T00:00:00Z" },
    job: { id: SEED.jobId, updated_at: "2026-06-09T00:00:00Z" },
    profile: { id: profileId, updated_at: profileUpdated },
  });
  await db.from("analysis_decisions").insert([
    {
      user_id: profileId,
      match_id: SEED.matchId,
      label: "not_recommended",
      display_label: "Not Recommended Yet",
      match_score: 42,
      scores_json: { overall: 42, skill: 45, experience: 55, ai_readiness: 30, ats_keywords: 48, seniority: 60 },
      risk_level: "high",
      confidence: 0.55,
      confidence_reasons_json: [],
      summary: "Several core requirements are missing right now.",
      evidence_json: {
        matched: [{ label: "Python", detail: "Primary backend language." }],
        missing: ["RAG pipelines", "Vector embeddings", "Production LLM experience"],
        risks: ["Critical AI requirements unmet."],
      },
      inputs_snapshot_json: stamp("2026-06-07T00:00:00Z"),
      inputs_hash: "e2e-hash-1",
      rules_version: "p11.r1",
      previous_label: null,
      decided_at: "2026-06-10T12:00:00Z",
    },
    {
      user_id: profileId,
      match_id: SEED.matchId,
      label: "learning_target",
      display_label: "Learning Target",
      match_score: 58,
      scores_json: { overall: 58, skill: 62, experience: 58, ai_readiness: 48, ats_keywords: 60, seniority: 60 },
      risk_level: "medium",
      confidence: 0.62,
      confidence_reasons_json: [],
      summary: "A directionally relevant role to build toward.",
      evidence_json: {
        matched: [
          { label: "Python", detail: "Primary backend language." },
          { label: "FastAPI", detail: "Core to the stack." },
        ],
        missing: ["RAG pipelines", "Vector embeddings"],
        risks: ["Limited production LLM experience."],
      },
      inputs_snapshot_json: stamp("2026-06-08T00:00:00Z"),
      inputs_hash: "e2e-hash-2",
      rules_version: "p11.r1",
      previous_label: "not_recommended",
      decided_at: "2026-06-10T12:30:00Z",
    },
    {
      user_id: profileId,
      match_id: SEED.matchId,
      label: "apply_with_improvements",
      display_label: "Apply With Improvements",
      match_score: 63,
      scores_json: { overall: 63, skill: 70, experience: 60, ai_readiness: 55, ats_keywords: 65, seniority: 60 },
      risk_level: "medium",
      confidence: 0.8,
      confidence_reasons_json: [],
      summary: "A good match with a couple of gaps to close before applying.",
      evidence_json: {
        matched: [
          { label: "FastAPI", detail: "Core to the backend stack." },
          { label: "Python", detail: "Primary language for AI tooling." },
        ],
        missing: ["RAG pipelines", "Vector embeddings"],
        risks: ["May be screened out for limited production LLM experience."],
      },
      inputs_snapshot_json: stamp("2026-06-09T00:00:00Z"),
      inputs_hash: "e2e-hash-3",
      // Newer rules version than the snapshot below → "decision rules updated" marker.
      rules_version: "p11.r2",
      previous_label: "learning_target",
      decided_at: "2026-06-10T13:00:00Z",
    },
  ]);

  return { matchId: SEED.matchId };
}

// Remove everything the seed created for this profile (including any learning
// target the test saved, and any resume/job deletion audit rows a US-055 test
// wrote). Exact, so it never leaves residue in the live DB.
export async function teardownAnalyzedMatch(profileId: string): Promise<void> {
  const db = adminClient();
  await db.from("applications").delete().eq("user_id", profileId);
  await db.from("analysis_decisions").delete().eq("match_id", SEED.matchId);
  await db.from("matches").delete().eq("id", SEED.matchId);
  await db.from("jobs").delete().eq("id", SEED.jobId);
  await db.from("resumes").delete().eq("id", SEED.resumeId);
  await db
    .from("activity_feed")
    .delete()
    .eq("user_id", profileId)
    .in("activity_type", ["resume.deleted", "job.deleted"]);
}

// True if a row with the given id still exists in the table. Used by the
// US-055 deletion specs to prove a hard delete (and its cascade) actually
// reached the database, not just the UI.
export async function rowExists(table: string, id: string): Promise<boolean> {
  const { count } = await adminClient()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("id", id);
  return (count ?? 0) > 0;
}

// The most recent deletion audit row of a given type for the profile, or null.
export async function findDeletionAudit(
  profileId: string,
  activityType: "resume.deleted" | "job.deleted"
): Promise<{ title: string; assistant_description: string } | null> {
  const { data } = await adminClient()
    .from("activity_feed")
    .select("title, assistant_description")
    .eq("user_id", profileId)
    .eq("activity_type", activityType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { title: string; assistant_description: string } | null) ?? null;
}
