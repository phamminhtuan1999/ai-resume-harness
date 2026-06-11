import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidateView,
  candidateLinks,
  displayName,
  profileCompleteness,
  workspaceSnapshot,
} from "../src/lib/profile-view.mjs";

function importedProfile() {
  return {
    basic_info: {
      full_name: "Dana Engineer",
      email: "dana@example.com",
      phone: "555-0100",
      location: "Remote US",
      linkedin_url: "https://linkedin.com/in/dana",
      github_url: "https://github.com/dana",
      portfolio_url: null,
      current_title: "Senior SWE",
    },
    professional_summary: {
      candidate_summary: "Senior backend engineer with FastAPI depth.",
      primary_engineering_background: "Python backend systems",
    },
    skills: {
      programming_languages: ["Python", " TypeScript "],
      backend: ["FastAPI"],
      frontend: [],
      ai_ml: ["RAG"],
    },
    work_experience: [
      {
        company: "Acme",
        title: "Senior Engineer",
        location: "Remote",
        start_date: "2020",
        end_date: "2024",
        bullet_points: ["Built FastAPI services.", "Cut latency 38%."],
      },
      { company: "", title: "", bullet_points: [] },
    ],
    education: [
      { school: "State University", degree: "BSc", field_of_study: "CS", dates: "2016" },
    ],
    certifications: [{ name: "AWS SAA", issuer: "Amazon", date: "2022" }],
  };
}

test("profileCompleteness counts filled targeting fields and names the missing", () => {
  const result = profileCompleteness({
    current_role: "Backend Engineer",
    years_of_experience: 6,
    target_role: "AI Engineer",
    location_preference: "  ",
    technical_background: null,
  });
  assert.equal(result.filled, 3);
  assert.equal(result.total, 5);
  assert.deepEqual(result.missing, ["Location preference", "Technical background"]);
});

test("profileCompleteness treats zero years as filled", () => {
  const result = profileCompleteness({ years_of_experience: 0 });
  assert.ok(!result.missing.includes("Years of experience"));
});

test("buildCandidateView normalizes skills, experience, education, certifications", () => {
  const view = buildCandidateView(importedProfile());
  assert.equal(view.name, "Dana Engineer");
  assert.equal(view.title, "Senior SWE");
  assert.equal(view.summary, "Senior backend engineer with FastAPI depth.");

  // Empty skill groups are dropped; items are trimmed; labels humanized.
  assert.deepEqual(
    view.skillGroups.map((g) => g.label),
    ["Languages", "Backend", "AI & ML"]
  );
  assert.deepEqual(view.skillGroups[0].items, ["Python", "TypeScript"]);

  // Blank experience rows are dropped; the first bullet becomes the highlight.
  assert.equal(view.experience.length, 1);
  assert.equal(view.experience[0].dates, "2020 - 2024");
  assert.equal(view.experience[0].highlight, "Built FastAPI services.");

  assert.equal(view.education[0].line, "BSc, CS");
  assert.equal(view.certifications[0].name, "AWS SAA");
});

test("buildCandidateView returns null when nothing was imported", () => {
  assert.equal(buildCandidateView(null), null);
  assert.equal(buildCandidateView({}), null);
  assert.equal(buildCandidateView({ basic_info: { current_title: "" } }), null);
});

test("candidateLinks keeps only present links", () => {
  const links = candidateLinks(importedProfile().basic_info);
  assert.deepEqual(
    links.map((l) => l.label),
    ["LinkedIn", "GitHub"]
  );
  assert.equal(links[1].href, "https://github.com/dana");
});

test("displayName prefers imported name, then account fields", () => {
  const view = buildCandidateView(importedProfile());
  assert.equal(displayName({ full_name: "Account Name" }, view), "Dana Engineer");
  assert.equal(displayName({ full_name: "Account Name" }, null), "Account Name");
  assert.equal(displayName({ email: "a@b.c" }, null), "a@b.c");
  assert.equal(displayName(null, null), "Your profile");
});

test("workspaceSnapshot returns linked counts with safe fallbacks", () => {
  const tiles = workspaceSnapshot({ resumes: 5, jobs: "10", matches: undefined });
  assert.deepEqual(
    tiles.map((t) => [t.label, t.count, t.href]),
    [
      ["Resumes", 5, "/resumes"],
      ["Saved jobs", 10, "/jobs"],
      ["Analyzed jobs", 0, "/matches"],
    ]
  );
});
