import assert from "node:assert/strict";
import test from "node:test";

import {
  computeJobPreScore,
  jobStructuredSignals,
  locationFit,
  preScoreTierLabel,
  seniorityFit,
  skillOverlap,
  titleAlignment,
} from "../src/lib/job-prescore.mjs";

const PROFILE = {
  target_role: "AI Engineer",
  current_role: "Backend Engineer",
  years_of_experience: 5,
  technical_background: "Python, FastAPI, RAG, embeddings, Postgres, Docker",
  location_city: "Austin",
  location_country: "USA",
  location_preference: "remote",
};

function jobWith(extraction = {}, structured = {}, row = {}) {
  return { title: "AI Engineer", extraction_json: extraction, structured_json: structured, ...row };
}

test("a job with no structured data scores insufficient, never a fake number", () => {
  const result = computeJobPreScore({ profile: PROFILE, job: { title: "AI Engineer" } });
  assert.equal(result.tier, "insufficient");
  assert.equal(result.score, null);
  assert.equal(result.hasStructured, false);
  assert.equal(preScoreTierLabel(result.tier), "Not enough info");
});

test("structured signals merge extraction over structured over row", () => {
  const signals = jobStructuredSignals(
    jobWith(
      { required_skills: ["Python", "RAG"], work_type: "remote", location: "Remote US" },
      { seniority: "senior", years_required: 4 }
    )
  );
  assert.deepEqual(signals.requiredSkills, ["Python", "RAG"]);
  assert.equal(signals.workType, "remote");
  assert.equal(signals.seniority, "senior");
  assert.equal(signals.yearsRequired, 4);
});

test("skill overlap rises with profile coverage of required skills", () => {
  const all = skillOverlap(["python", "fastapi", "rag"], PROFILE);
  const none = skillOverlap(["kubernetes", "terraform", "go"], PROFILE);
  assert.ok(all > none);
  assert.equal(skillOverlap(["python", "fastapi", "rag"], { technical_background: "" }), 35);
});

test("title alignment rewards target-role overlap", () => {
  const aligned = titleAlignment("AI Engineer", PROFILE);
  const off = titleAlignment("Frontend Designer", PROFILE);
  assert.ok(aligned > off);
});

test("seniority fit penalizes a candidate short of the required years", () => {
  const enough = seniorityFit({ yearsRequired: 4 }, { years_of_experience: 6 });
  const short = seniorityFit({ yearsRequired: 8 }, { years_of_experience: 3 });
  assert.equal(enough, 90);
  assert.ok(short < enough);
});

test("location fit favors remote and penalizes onsite for a remote-seeker", () => {
  const remote = locationFit({ workType: "remote" }, PROFILE);
  const onsite = locationFit({ workType: "onsite", location: "Berlin, Germany" }, PROFILE);
  assert.equal(remote, 100);
  assert.ok(onsite < remote);
});

test("a strong-overlap remote AI role scores into a high tier", () => {
  const result = computeJobPreScore({
    profile: PROFILE,
    job: jobWith({
      required_skills: ["Python", "FastAPI", "RAG", "embeddings"],
      work_type: "remote",
      required_experience_years: 4,
    }),
  });
  assert.equal(result.hasStructured, true);
  assert.ok(result.score >= 70);
  assert.equal(result.tier, "strong");
  assert.equal(preScoreTierLabel(result.tier), "Likely fit");
});

test("a mismatched onsite role with foreign skills scores low", () => {
  const result = computeJobPreScore({
    profile: PROFILE,
    job: {
      title: "Embedded Firmware Engineer",
      extraction_json: {
        required_skills: ["C++", "RTOS", "VHDL", "Verilog"],
        work_type: "onsite",
        location: "Munich, Germany",
        required_experience_years: 9,
      },
    },
  });
  assert.equal(result.tier, "weak");
  assert.ok(result.score < 45);
});

test("the scorer is pure — same inputs, same result", () => {
  const job = jobWith({ required_skills: ["Python"], work_type: "remote" });
  const a = computeJobPreScore({ profile: PROFILE, job });
  const b = computeJobPreScore({ profile: PROFILE, job });
  assert.deepEqual(a, b);
});
