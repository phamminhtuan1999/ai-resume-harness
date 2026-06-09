import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCandidateProfile } from "../src/lib/candidate-profile-view.mjs";
import { normalizeStructuredJob } from "../src/lib/job-structured-view.mjs";
import { stepOutputDetails } from "../src/lib/ai-workflow-panel.mjs";

test("normalizeStructuredJob builds facts and sections from the extraction", () => {
  const view = normalizeStructuredJob(
    {
      location: "Remote US",
      work_type: "remote",
      employment_type: "full-time",
      salary_range: "$160k–$200k",
      required_experience_years: "5+",
      responsibilities: ["Build AI features", ""],
      required_skills: ["Python", "FastAPI"],
      preferred_skills: ["pgvector"],
      ai_related_requirements: ["RAG pipelines"],
      cloud_requirements: ["AWS"],
      confidence_score: 0.87,
    },
    { location: "Ignored — extraction wins" }
  );

  assert.equal(view.has_structured, true);
  assert.deepEqual(
    view.facts.map((fact) => `${fact.label}: ${fact.value}`),
    [
      "Location: Remote US",
      "Work type: Remote",
      "Employment: Full-time",
      "Salary: $160k–$200k",
      "Experience: 5+",
    ]
  );
  assert.deepEqual(
    view.sections.map((section) => section.label),
    [
      "Responsibilities",
      "Required skills",
      "Preferred skills",
      "AI-related requirements",
      "Cloud requirements",
    ]
  );
  assert.equal(view.confidence_score, 0.87);
});

test("normalizeStructuredJob falls back to job-row facts and reports empties", () => {
  const fromRow = normalizeStructuredJob(null, {
    location: "Hanoi",
    work_type: "hybrid",
    salary_range: "",
  });
  assert.equal(fromRow.has_structured, true);
  assert.deepEqual(fromRow.facts, [
    { label: "Location", value: "Hanoi" },
    { label: "Work type", value: "Hybrid" },
  ]);

  const empty = normalizeStructuredJob({ work_type: "unknown" }, {});
  assert.equal(empty.has_structured, false);
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

test("stepOutputDetails renders friendly sections per workflow type", () => {
  const roadmap = stepOutputDetails("roadmap", {
    roadmap_summary: "Close RAG gaps.",
    recommended_project_theme: "Q&A assistant.",
    weeks: [
      { week: 1, goal: "RAG demo" },
      { week: 2, goal: "Eval harness" },
    ],
    success_criteria: ["Public demo"],
  });
  assert.deepEqual(
    roadmap.map((section) => section.label),
    ["Summary", "Project theme", "Weeks", "Success criteria"]
  );
  assert.deepEqual(roadmap[2].items, ["Week 1: RAG demo", "Week 2: Eval harness"]);

  const letter = stepOutputDetails("cover_letter", {
    cover_letter: "Dear team,\nI am applying.",
    key_points_used: ["FastAPI"],
  });
  assert.equal(letter[0].label, "Cover letter");
  assert.match(letter[0].text, /Dear team/);

  const insight = stepOutputDetails("assistant_insight", {
    assistant_summary: "Tailor first.",
    recommendation: "build_project_first",
  });
  assert.equal(insight[1].text, "build project first");

  // Unknown types and empty snapshots stay quiet.
  assert.deepEqual(stepOutputDetails("unknown_type", { a: 1 }), []);
  assert.deepEqual(stepOutputDetails("match_analysis", null), []);
});
