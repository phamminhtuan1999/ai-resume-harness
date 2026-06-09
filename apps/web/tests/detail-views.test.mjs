import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCandidateProfile } from "../src/lib/candidate-profile-view.mjs";
import {
  buildJobPostView,
  deriveOverviewFromDescription,
} from "../src/lib/job-structured-view.mjs";
import { stepOutputView } from "../src/lib/ai-workflow-panel.mjs";

test("buildJobPostView prefers the rich extraction and keeps job-post order", () => {
  const view = buildJobPostView({
    extraction: {
      location: "Remote US",
      work_type: "remote",
      employment_type: "full-time",
      salary_range: "$160k–$200k",
      required_experience_years: "5+",
      role_summary: "Own the AI features end to end.",
      about_company: "We build hiring tools.",
      responsibilities: ["Build AI features", ""],
      required_skills: ["Python", "FastAPI"],
      preferred_skills: ["pgvector"],
      ai_related_requirements: ["RAG pipelines"],
      cloud_requirements: ["AWS"],
      benefits: ["Remote budget"],
      confidence_score: 0.87,
    },
    structured: { required_skills: ["ignored"], years_required: 3 },
    jobRow: { location: "Ignored — extraction wins" },
  });

  assert.equal(view.has_structured, true);
  assert.equal(view.overview, "Own the AI features end to end.");
  assert.equal(view.overview_derived, false);
  assert.equal(view.about_company, "We build hiring tools.");
  assert.deepEqual(
    view.facts.map((item) => `${item.label}: ${item.value}`),
    [
      "Location: Remote US",
      "Work type: Remote",
      "Employment: Full-time",
      "Salary: $160k–$200k",
      "Experience: 5+",
    ]
  );
  assert.deepEqual(view.responsibilities, ["Build AI features"]);
  assert.deepEqual(view.required_skills, ["Python", "FastAPI"]);
  assert.deepEqual(view.preferred_skills, ["pgvector"]);
  assert.deepEqual(view.benefits, ["Remote budget"]);
  assert.equal(view.confidence_score, 0.87);
});

test("buildJobPostView falls back to the thin analyzer payload and the job row", () => {
  const view = buildJobPostView({
    structured: {
      required_skills: ["python", "sql"],
      years_required: 3,
      seniority: "senior",
    },
    jobRow: {
      location: "Hanoi",
      work_type: "hybrid",
      raw_description:
        "Heading\n\nWe are an analytics company hiring a senior engineer to build our data platform and own reliability across the stack.\n\n- bullet",
    },
  });

  assert.equal(view.has_structured, true);
  assert.deepEqual(view.required_skills, ["python", "sql"]);
  assert.deepEqual(
    view.facts.map((item) => `${item.label}: ${item.value}`),
    ["Location: Hanoi", "Work type: Hybrid", "Experience: 3+ years", "Seniority: senior"]
  );
  // No role_summary → the overview comes from the description's first paragraph.
  assert.match(view.overview, /analytics company hiring a senior engineer/);
  assert.equal(view.overview_derived, true);

  assert.equal(buildJobPostView({}).has_structured, false);
});

test("deriveOverviewFromDescription skips headings and clips at a sentence", () => {
  assert.equal(deriveOverviewFromDescription("# Title\n\n- a\n- b"), "");
  const longSentence = "This is a meaningful opening sentence about the role. ";
  const text = `${longSentence.repeat(20)}`;
  const overview = deriveOverviewFromDescription(text);
  assert.ok(overview.length <= 600);
  assert.match(overview, /\.$/);
});

test("normalizeCandidateProfile breaks the imported profile into sections", () => {
  const view = normalizeCandidateProfile({
    basic_info: {
      full_name: "Minh Tuan Pham",
      current_title: "Senior Backend Engineer",
      years_of_experience: 4,
      location: "Ho Chi Minh",
      email: "x@y.z",
      github_url: "https://github.com/x",
    },
    professional_summary: {
      candidate_summary: "Backend engineer moving into AI.",
      primary_engineering_background: "Backend",
      seniority_level: "Senior",
    },
    skills: {
      programming_languages: ["Python", "TypeScript"],
      ai_ml: ["RAG"],
      tools: [],
    },
    work_experience: [
      {
        company: "Acme",
        title: "Backend Engineer",
        start_date: "2021",
        is_current_role: true,
        bullet_points: ["Built APIs"],
        detected_skills: ["FastAPI"],
      },
    ],
    projects: [{ project_name: "Travel AI", tech_stack: ["Next.js"] }],
    education: [{ school: "HCMUT", degree: "BSc", field_of_study: "CS" }],
    certifications: [{ name: "AWS SAA", issuer: "AWS" }],
    ai_metadata: {
      strongest_skills: ["Python"],
      suggested_target_roles: ["AI Engineer"],
      weak_ai_role_areas: ["Evaluation"],
    },
  });

  assert.equal(view.has_profile, true);
  assert.equal(view.facts[0].value, "Minh Tuan Pham");
  assert.equal(view.facts[2].value, "4 year(s)");
  assert.deepEqual(view.links, [{ label: "GitHub", value: "https://github.com/x" }]);
  assert.equal(view.overview, "Backend engineer moving into AI.");
  assert.deepEqual(
    view.skill_groups.map((group) => group.label),
    ["Languages", "AI / ML"]
  );
  assert.equal(view.experience[0].period, "2021 – Present");
  assert.equal(view.education[0].degree, "BSc, CS");
  assert.deepEqual(view.suggested_target_roles, ["AI Engineer"]);

  assert.equal(normalizeCandidateProfile(null).has_profile, false);
});

test("stepOutputView is a digest: facts, one summary block, count-aware link", () => {
  const gaps = stepOutputView("missing_skills", {
    summary: "Two gaps matter most.",
    missing_skills: [
      { skill: "LangChain", importance: "critical" },
      { skill: "Terraform", importance: "medium" },
      { skill: "Grafana", importance: "nice_to_have" },
    ],
    top_3_priority_gaps: ["LangChain", "Terraform"],
  });
  assert.deepEqual(
    gaps.facts.map((item) => `${item.value} (${item.tone})`),
    ["1 critical (destructive)", "1 medium (warning)", "1 nice-to-have (neutral)"]
  );
  assert.deepEqual(
    gaps.blocks.map((block) => block.kind),
    ["prose", "chips"]
  );
  assert.equal(gaps.link_label, "Review all 3 gaps with how-to-fix guidance");

  const suggestions = stepOutputView("resume_suggestions", {
    resume_strategy: "Lead with platform work.",
    suggestions: [
      { suggested_text: "Led the API migration", truth_guard_status: "safe_to_use" },
      { suggested_text: "Knows Kubernetes", truth_guard_status: "do_not_use_yet" },
    ],
  });
  assert.deepEqual(
    suggestions.facts.map((item) => item.value),
    ["1 safe to use", "1 do not use yet"]
  );
  assert.equal(suggestions.blocks.length, 1);
  assert.equal(suggestions.link_label, "Review all 2 suggestions");
});

test("stepOutputView renders the cover letter as a capped document digest", () => {
  const view = stepOutputView("cover_letter", {
    cover_letter: "Dear team,\nI am applying.",
    tone: "professional",
    cover_letter_strategy: "Not shown inline anymore.",
  });

  assert.deepEqual(
    view.facts.map((item) => item.value),
    ["5 words", "Professional tone"]
  );
  // Digest: only the letter itself; strategy/key points live on the page.
  assert.deepEqual(view.blocks.map((block) => block.kind), ["document"]);
  assert.match(view.blocks[0].text, /Dear team/);
  assert.equal(view.link_label, "Open the cover letter workspace");
});

test("stepOutputView trims roadmap/interview digests and skips on-page steps", () => {
  const roadmap = stepOutputView("roadmap", {
    roadmap_summary: "Close the gaps in four weeks.",
    weeks: [
      { week: 1, goal: "RAG demo", tasks: ["a", "b"] },
      { week: 2, goal: "Eval harness", tasks: ["c"] },
    ],
  });
  assert.deepEqual(
    roadmap.facts.map((item) => item.value),
    ["2 weeks", "3 tasks"]
  );
  const goals = roadmap.blocks.find((block) => block.kind === "list");
  assert.deepEqual(goals.items, ["Week 1 — RAG demo", "Week 2 — Eval harness"]);

  const prep = stepOutputView("interview_prep", {
    prep_summary: "Focus on RAG fundamentals.",
    technical_questions: ["q1"],
    ai_llm_questions: ["q2"],
    system_design_questions: ["q3"],
    behavioral_questions: ["q4"],
    weak_topics_to_study: ["Evaluation"],
  });
  assert.equal(prep.facts[0].value, "4 questions");
  assert.equal(prep.link_label, "Review all 4 questions with answer guidance");
  assert.deepEqual(prep.blocks.map((block) => block.kind), ["prose", "chips"]);

  // match_analysis and assistant_insight render natively on the match page —
  // no digest, so the panel shows no expander for them.
  assert.deepEqual(stepOutputView("match_analysis", { overall_score: 80 }).blocks, []);
  assert.deepEqual(stepOutputView("assistant_insight", { assistant_summary: "x" }), {
    facts: [],
    blocks: [],
    link_label: null,
  });

  // Unknown types and empty snapshots stay quiet.
  const unknown = stepOutputView("unknown_type", { a: 1 });
  assert.deepEqual(unknown, { facts: [], blocks: [], link_label: null });
});
