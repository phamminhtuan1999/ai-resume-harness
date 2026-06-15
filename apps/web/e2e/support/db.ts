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
  draftCvId: "44444444-4444-4444-8444-444444444444",
  draftCvV2Id: "44444444-4444-4444-8444-444444444445",
  suggestionAcceptedId: "55555555-5555-4555-8555-555555555551",
  suggestionPendingId: "55555555-5555-4555-8555-555555555552",
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
      // Extracted keywords feed the deterministic coverage panel (US-062).
      structured_json: {
        required_skills: ["Python", "FastAPI", "RAG pipelines", "Kubernetes"],
        preferred_skills: ["AWS"],
      },
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

// Seed two tier-1 feedback rows for the seeded match (US-061): one already
// accepted with a user edit (authoritative information) and one still pending,
// so the Respond step renders both a responded and an actionable card.
export async function seedResumeSuggestions(): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("resume_suggestions").upsert(
    [
      {
        id: SEED.suggestionAcceptedId,
        match_id: SEED.matchId,
        original_text: "Built APIs in Python.",
        suggested_text: "Shipped FastAPI services powering the E2E payments flow.",
        suggestion_type: "experience",
        related_job_requirement: "Python/FastAPI services",
        evidence: "Resume: 6 years building APIs in Python and FastAPI.",
        truth_guard_status: "Safe to use",
        reason: "Directly supported by resume evidence.",
        user_action: "accepted",
        user_edited: true,
        created_at: "2026-06-10T12:00:00Z",
        updated_at: "2026-06-10T12:30:00Z",
      },
      {
        id: SEED.suggestionPendingId,
        match_id: SEED.matchId,
        original_text: "Worked with AWS.",
        suggested_text: "Operated E2E workloads on AWS with infrastructure as code.",
        suggestion_type: "experience",
        related_job_requirement: "Cloud infrastructure",
        evidence: "Resume: APIs on AWS.",
        truth_guard_status: "Needs confirmation",
        reason: "IaC depth is not explicit in the resume.",
        user_action: "pending",
        user_edited: false,
        created_at: "2026-06-10T12:00:00Z",
        updated_at: "2026-06-10T12:00:00Z",
      },
    ],
    { onConflict: "id" }
  );
  if (error) throw new Error(`Could not seed suggestions: ${error.message}`);
}

// Seed one exportable Draft CV version for the seeded match (US-059). One
// renderable bullet plus one do_not_use_yet bullet prove the export gating in
// the browser; rendering_json stays null so the page uses the legacy render
// path (no page/font pickers — just the export buttons).
export async function seedDraftCv(
  profileId: string,
  options: { withPendingAwsBullet?: boolean; provider?: "gemini" | "deterministic" } = {}
): Promise<{ draftCvId: string }> {
  const db = adminClient();
  // Optional needs_confirmation bullet covering a job keyword (AWS) the
  // renderable content misses — approving it moves the coverage number
  // (US-062 E2E).
  const pendingBullets = options.withPendingAwsBullet
    ? [
        {
          id: "b-aws",
          text: "Operated production workloads on AWS.",
          source_evidence: "resume: APIs on AWS",
          truth_guard_status: "needs_confirmation",
          keywords_used: ["AWS"],
          user_action: "pending",
        },
      ]
    : [];
  const { error } = await db.from("draft_cvs").upsert(
    {
      id: SEED.draftCvId,
      user_id: profileId,
      match_id: SEED.matchId,
      job_id: SEED.jobId,
      resume_id: SEED.resumeId,
      version: 1,
      title: "Draft CV — Northwind AI Applied AI Engineer v1",
      status: options.withPendingAwsBullet ? "needs_review" : "ready_to_export",
      cv_json: {
        candidate: { full_name: "Dana E2E Engineer", email: "dana.e2e@example.com" },
        target_job: { company: "Northwind AI", title: "Applied AI Engineer" },
        professional_summary: "Backend engineer moving into applied AI.",
        skills: [{ category: "Backend", items: ["Python", "FastAPI"] }],
        work_experience: [
          {
            company: "Acme",
            title: "Engineer",
            location: "Remote",
            start_date: "2020",
            end_date: "2024",
            bullets: [
              {
                id: "b-safe",
                text: "Engineered E2ESafeAlpha services in FastAPI.",
                source_evidence: "resume",
                truth_guard_status: "safe_to_use",
                keywords_used: ["FastAPI"],
                user_action: "pending",
                // Links to the accepted seeded suggestion (US-061 trace).
                source_feedback_id: SEED.suggestionAcceptedId,
              },
              {
                id: "b-blocked",
                text: "Improved E2EForbiddenBeta throughput.",
                source_evidence: "",
                truth_guard_status: "do_not_use_yet",
                keywords_used: [],
                user_action: "pending",
              },
              ...pendingBullets,
            ],
          },
        ],
        projects: [],
        education: [],
        certifications: [],
      },
      cv_strategy_json: {
        summary: "Lead with FastAPI evidence.",
        primary_positioning: "Backend engineer moving toward AI roles.",
        keywords_prioritized: ["FastAPI"],
        // Kubernetes is a job keyword the candidate cannot support — the
        // coverage panel must list it as "not claimable", never as a miss.
        keywords_excluded: [{ keyword: "Kubernetes", reason: "unsupported" }],
      },
      quality_notes_json: [],
      confidence_score: 0.9,
      // The seeded draft carries woven feedback links, which only the model
      // path produces in reality — so it defaults to "gemini". Pass
      // provider: "deterministic" to exercise the offline-fallback labeling.
      provider: options.provider ?? "gemini",
      model_name:
        (options.provider ?? "gemini") === "gemini"
          ? "gemini-3.5-flash"
          : "deterministic-baseline",
      rendering_json: null,
      created_at: "2026-06-10T13:30:00Z",
      updated_at: "2026-06-10T13:30:00Z",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Could not seed draft CV: ${error.message}`);
  return { draftCvId: SEED.draftCvId };
}

// Seed a second Tailored CV version for the match (US-063 staleness): a
// letter linked to v1 becomes stale once v2 is the latest version.
export async function seedSecondDraftVersion(profileId: string): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("draft_cvs").upsert(
    {
      id: SEED.draftCvV2Id,
      user_id: profileId,
      match_id: SEED.matchId,
      job_id: SEED.jobId,
      resume_id: SEED.resumeId,
      version: 2,
      title: "Draft CV — Northwind AI Applied AI Engineer v2",
      status: "ready_to_export",
      cv_json: {
        candidate: { full_name: "Dana E2E Engineer" },
        professional_summary: "Backend engineer moving into applied AI (v2).",
        skills: [{ category: "Backend", items: ["Python", "FastAPI"] }],
        work_experience: [],
        projects: [],
        education: [],
        certifications: [],
      },
      cv_strategy_json: {},
      quality_notes_json: [],
      confidence_score: 0.9,
      provider: "deterministic",
      model_name: "deterministic",
      rendering_json: null,
      created_at: "2026-06-10T15:00:00Z",
      updated_at: "2026-06-10T15:00:00Z",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Could not seed draft v2: ${error.message}`);
}

// Seed a cover letter linked to a Tailored CV version (US-063). Pass a
// sourceDraftCvId that differs from the latest seeded draft to exercise the
// staleness hint.
export async function seedCoverLetter(
  profileId: string,
  options: { sourceDraftCvId?: string; sourceVersion?: number } = {}
): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("cover_letters").upsert(
    {
      user_id: profileId,
      match_id: SEED.matchId,
      job_id: SEED.jobId,
      cover_letter: "Dear Northwind AI Hiring Team,\n\nE2E letter body.\n\nSincerely,\nDana",
      cover_letter_strategy: "Lead with FastAPI evidence from the tailored CV.",
      key_points_json: ["FastAPI"],
      claims_avoided_json: [],
      tone: "professional",
      confidence_score: 0.8,
      provider: "deterministic",
      source_draft_cv_id: options.sourceDraftCvId ?? SEED.draftCvId,
      source_draft_cv_version: options.sourceVersion ?? 1,
    },
    { onConflict: "match_id" }
  );
  if (error) throw new Error(`Could not seed cover letter: ${error.message}`);
}

// Attach one regenerate-preservation conflict to the seeded draft (US-060):
// a finalized bullet whose previous entry the "regeneration" restructured away.
export async function seedPreservationConflict(): Promise<void> {
  const db = adminClient();
  const { data, error } = await db
    .from("draft_cvs")
    .select("cv_json")
    .eq("id", SEED.draftCvId)
    .single();
  if (error || !data) throw new Error(`Could not load seeded draft: ${error?.message}`);
  const cvJson = data.cv_json as Record<string, unknown>;
  cvJson.preservation_conflicts = [
    {
      section: "work_experience",
      entry: { company: "OldCo", title: "Platform Engineer" },
      bullet: {
        id: "b-conflict",
        text: "Stabilized the E2EConflictDelta platform rollout.",
        source_evidence: "resume",
        truth_guard_status: "safe_to_use",
        keywords_used: [],
        user_action: "pending",
        user_edited: true,
        polished: true,
        finalized_at: "2026-06-10T14:00:00Z",
      },
    },
  ];
  const { error: updateError } = await db
    .from("draft_cvs")
    .update({ cv_json: cvJson })
    .eq("id", SEED.draftCvId);
  if (updateError) throw new Error(`Could not seed conflict: ${updateError.message}`);
}

// Seed the missing-skill analysis for the seeded match (US-029). One row per
// match (UNIQUE match_id); upsert keeps it idempotent. Populates the Skill Gaps
// page/tab instead of its empty "generate" state.
export async function seedMissingSkills(profileId: string): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("missing_skill_analyses").upsert(
    {
      user_id: profileId,
      match_id: SEED.matchId,
      summary: "RAG and embeddings are the priority gaps for this role.",
      missing_skills_json: [
        {
          skill: "RAG pipelines",
          importance: "critical",
          gap_type: "true_gap",
          evidence_status: "no_evidence",
          resume_evidence: null,
          job_requirement: "Build RAG pipelines for document retrieval.",
          why_it_matters: "Central to the Applied AI Engineer role.",
          how_to_fix: "Build a small RAG project over your own documents.",
          suggested_project_task: "Index docs and answer questions over them.",
          interview_risk: "Expect deep RAG design questions.",
        },
        {
          skill: "Vector Embeddings",
          importance: "critical",
          gap_type: "true_gap",
          evidence_status: "no_evidence",
          resume_evidence: null,
          job_requirement: "Use vector embeddings for retrieval.",
          why_it_matters: "Essential for any RAG system.",
          how_to_fix: "Learn pgvector with hands-on indexing work.",
          suggested_project_task: "Add a pgvector store to the RAG project.",
          interview_risk: "They will ask about embedding selection tradeoffs.",
        },
        {
          skill: "Kubernetes",
          importance: "medium",
          gap_type: "wording_gap",
          evidence_status: "weak_evidence",
          resume_evidence: "Deployed services on AWS.",
          job_requirement: "Operate workloads on Kubernetes.",
          why_it_matters: "Listed as a preferred operational skill.",
          how_to_fix: "Frame your AWS deployment work and add a k8s deploy.",
          suggested_project_task: null,
          interview_risk: "May be asked to compare ECS and Kubernetes.",
        },
      ],
      top_3_priority_gaps_json: ["RAG pipelines", "Vector Embeddings", "Kubernetes"],
      confidence_score: 0.81,
      provider: "deterministic",
      created_at: "2026-06-10T13:00:00Z",
      updated_at: "2026-06-10T13:00:00Z",
    },
    { onConflict: "match_id" }
  );
  if (error) throw new Error(`Could not seed missing skills: ${error.message}`);
}

// Seed a 4-week roadmap for the seeded match. The roadmap page also requires a
// missing-skill analysis row, so call seedMissingSkills first. Delete-then-insert
// keeps it idempotent (multiple rows allowed per match; latest wins).
export async function seedRoadmap(profileId: string): Promise<void> {
  const db = adminClient();
  await db.from("roadmaps").delete().eq("match_id", SEED.matchId);
  const week = (
    n: number,
    goal: string,
    skill: string,
    bullet: string,
    talkingPoint: string
  ) => ({
    week: n,
    goal,
    skills_covered: [skill],
    tasks: [`Study ${skill} fundamentals.`, `Apply ${skill} in the portfolio project.`],
    deliverables: [`Working ${skill} demo with tests.`],
    project_feature: `${skill} capability on the multi-doc Q&A project.`,
    resume_bullet_after_completion: bullet,
    interview_talking_point: talkingPoint,
  });
  const { error } = await db.from("roadmaps").insert({
    user_id: profileId,
    match_id: SEED.matchId,
    title: "4-week Applied AI Engineer improvement roadmap for Northwind AI",
    roadmap_json: {
      roadmap_summary: "Closes RAG, embeddings, evaluation, and deployment gaps in 4 weeks.",
      recommended_project_theme: "Multi-document Q&A assistant with pgvector retrieval.",
      weeks: [
        week(
          1,
          "Close the RAG gap with a working demo.",
          "RAG pipelines",
          "Built a verified RAG capability into a portfolio project.",
          "Can explain RAG design tradeoffs."
        ),
        week(
          2,
          "Close the embeddings gap with pgvector.",
          "Vector Embeddings",
          "Built a verified embeddings capability with pgvector.",
          "Can explain embedding selection and tradeoffs."
        ),
        week(
          3,
          "Add an evaluation harness for the RAG outputs.",
          "LLM Evaluation",
          "Built a reproducible evaluation harness for an LLM system.",
          "Can explain evaluation pipeline design."
        ),
        week(
          4,
          "Deploy the complete application to a public URL.",
          "Deployment",
          "Shipped a production RAG system with evaluation to a public URL.",
          "Can discuss production AI deployment tradeoffs."
        ),
      ],
      success_criteria: [
        "A public demo URL exists.",
        "The evaluation harness produces reproducible scores.",
        "All code is on GitHub with clear documentation.",
      ],
      confidence_score: 0.82,
    },
    created_at: "2026-06-10T14:00:00Z",
    updated_at: "2026-06-10T14:00:00Z",
  });
  if (error) throw new Error(`Could not seed roadmap: ${error.message}`);
}

// Seed interview prep for the seeded match (US-035). Delete-then-insert keeps it
// idempotent. Populates the Interview Prep page instead of its empty state.
export async function seedInterviewPrep(profileId: string): Promise<void> {
  const db = adminClient();
  await db.from("interview_preps").delete().eq("match_id", SEED.matchId);
  const { error } = await db.from("interview_preps").insert({
    user_id: profileId,
    match_id: SEED.matchId,
    questions_json: {
      technical_questions: [
        "How have you built FastAPI services in production?",
        "What async patterns have you relied on, and when do they break down?",
      ],
      ai_llm_questions: [
        "How would you design a RAG pipeline for document retrieval?",
        "What vector database options have you evaluated, and how would you choose?",
      ],
      system_design_questions: [
        "Design a scalable job-matching service backed by RAG.",
        "How would you handle vector search at scale?",
      ],
      behavioral_questions: [
        "Tell me about a time you learned a missing skill quickly.",
        "How do you approach an unfamiliar AI framework under deadline?",
      ],
    },
    weak_topics_json: ["RAG pipelines", "Vector embeddings", "LLM evaluation"],
    study_plan_json: {
      prep_summary:
        "Expect deep RAG and LLM-evaluation questions. Lead with your FastAPI production experience; be honest where proof is missing and show learning agility.",
    },
    answer_guidance_json: [
      {
        question: "How have you built FastAPI services in production?",
        recommended_angle: "Lead with the production services you built and scaled on AWS.",
        resume_evidence_to_use:
          "Backend engineer with 6 years building APIs in Python and FastAPI on AWS.",
        warning: null,
      },
      {
        question: "How would you design a RAG pipeline for document retrieval?",
        recommended_angle: "Be honest that proof is limited; outline what you would build.",
        resume_evidence_to_use: null,
        warning: "No RAG pipeline evidence in the resume — build a working prototype first.",
      },
    ],
    created_at: "2026-06-10T14:30:00Z",
    updated_at: "2026-06-10T14:30:00Z",
  });
  if (error) throw new Error(`Could not seed interview prep: ${error.message}`);
}

// Remove everything the seed created for this profile (including any learning
// target the test saved, and any resume/job deletion audit rows a US-055 test
// wrote). Exact, so it never leaves residue in the live DB.
export async function teardownAnalyzedMatch(profileId: string): Promise<void> {
  const db = adminClient();
  await db.from("applications").delete().eq("user_id", profileId);
  await db.from("cover_letters").delete().eq("match_id", SEED.matchId);
  await db.from("interview_preps").delete().eq("match_id", SEED.matchId);
  await db.from("roadmaps").delete().eq("match_id", SEED.matchId);
  await db.from("missing_skill_analyses").delete().eq("match_id", SEED.matchId);
  await db.from("draft_cvs").delete().eq("id", SEED.draftCvV2Id);
  await db.from("draft_cvs").delete().eq("id", SEED.draftCvId);
  await db.from("analysis_decisions").delete().eq("match_id", SEED.matchId);
  await db.from("matches").delete().eq("id", SEED.matchId);
  await db.from("jobs").delete().eq("id", SEED.jobId);
  await db.from("resumes").delete().eq("id", SEED.resumeId);
  await db
    .from("activity_feed")
    .delete()
    .eq("user_id", profileId)
    .in("activity_type", ["resume.deleted", "job.deleted", "draft_cv.exported"]);
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
