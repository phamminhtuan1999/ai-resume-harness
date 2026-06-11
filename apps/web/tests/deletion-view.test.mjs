import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETION_CONFIRM_PHRASE,
  isDeletionConfirmed,
  jobDeletionAudit,
  jobDeletionSummary,
  jobDeletionSummaryGeneric,
  resumeDeletionAudit,
  resumeDeletionSummary,
  resumeDeletionSummaryGeneric,
} from "../src/lib/deletion-view.mjs";

test("resumeDeletionSummary states the cascade and permanence", () => {
  assert.equal(
    resumeDeletionSummary({ matches: 0 }),
    "Permanently deletes this resume. It has no matches yet. This cannot be undone."
  );
  assert.equal(
    resumeDeletionSummary({ matches: 1 }),
    "Permanently deletes this resume, its 1 match and every analysis generated from it. This cannot be undone."
  );
  assert.equal(
    resumeDeletionSummary({ matches: 3 }),
    "Permanently deletes this resume, its 3 matches and every analysis generated from them. This cannot be undone."
  );
});

test("jobDeletionSummary covers matches and tracked applications", () => {
  assert.equal(
    jobDeletionSummary({ matches: 0, applications: 0 }),
    "Permanently deletes this job. It has no matches or tracked applications yet. This cannot be undone."
  );
  assert.equal(
    jobDeletionSummary({ matches: 2, applications: 0 }),
    "Permanently deletes this job, its 2 matches and every analysis generated from them. This cannot be undone."
  );
  assert.equal(
    jobDeletionSummary({ matches: 1, applications: 1 }),
    "Permanently deletes this job, its 1 match and every analysis generated from it and 1 tracked application. This cannot be undone."
  );
  assert.equal(
    jobDeletionSummary({ matches: 0, applications: 2 }),
    "Permanently deletes this job, 2 tracked applications. This cannot be undone."
  );
});

test("audit helpers name the record and the cascade in past tense", () => {
  assert.deepEqual(resumeDeletionAudit("Backend CV", { matches: 0 }), {
    title: 'Deleted resume "Backend CV"',
    description: "The resume was permanently deleted.",
  });
  assert.deepEqual(resumeDeletionAudit("Backend CV", { matches: 2 }), {
    title: 'Deleted resume "Backend CV"',
    description: "The resume was permanently deleted along with 2 matches and their analyses.",
  });
  assert.deepEqual(jobDeletionAudit("Staff Eng", "Acme", { matches: 1, applications: 1 }), {
    title: 'Deleted job "Staff Eng at Acme"',
    description:
      "The job was permanently deleted along with 1 match and their analyses and 1 tracked application.",
  });
  assert.deepEqual(jobDeletionAudit("Staff Eng", "", { matches: 0, applications: 0 }), {
    title: 'Deleted job "Staff Eng"',
    description: "The job was permanently deleted.",
  });
});

test("generic list summaries are count-free but still warn about the cascade", () => {
  const resume = resumeDeletionSummaryGeneric();
  assert.match(resume, /^Permanently deletes this resume/);
  assert.match(resume, /matches and analyses/);
  assert.match(resume, /cannot be undone\.$/);
  // Count-free: no digits leak in from a per-row query that isn't run here.
  assert.equal(/\d/.test(resume), false);

  const job = jobDeletionSummaryGeneric();
  assert.match(job, /^Permanently deletes this job/);
  assert.match(job, /matches/);
  assert.match(job, /tracked applications/);
  assert.match(job, /cannot be undone\.$/);
  assert.equal(/\d/.test(job), false);
});

test("isDeletionConfirmed only accepts the exact phrase", () => {
  assert.equal(DELETION_CONFIRM_PHRASE, "DELETE");
  assert.equal(isDeletionConfirmed("DELETE"), true);
  assert.equal(isDeletionConfirmed("delete"), false);
  assert.equal(isDeletionConfirmed(" DELETE "), false);
  assert.equal(isDeletionConfirmed(""), false);
  assert.equal(isDeletionConfirmed(undefined), false);
});
