import assert from "node:assert/strict";
import test from "node:test";

import { analysisHealthNotice } from "../src/lib/analysis-error-view.mjs";

test("a healthy analysis has no notice", () => {
  assert.equal(analysisHealthNotice([], { jobId: "j1" }), null);
  assert.equal(analysisHealthNotice(undefined), null);
  // Reasons unrelated to job description or module failure don't raise a notice.
  assert.equal(analysisHealthNotice(["no_target_role"], { jobId: "j1" }), null);
});

test("an AI/model failure points at Refresh Analysis", () => {
  const notice = analysisHealthNotice(["module_failed"], { jobId: "j1" });
  assert.equal(notice.recovery.kind, "refresh");
  assert.match(notice.message, /Refresh/i);
  // No technical/module vocabulary in the user-facing copy.
  assert.doesNotMatch(`${notice.title} ${notice.message}`, /module|provider|json|gemini/i);
});

test("a missing/short job description sends the user to the job edit surface", () => {
  const extracted = analysisHealthNotice(["job_not_extracted"], { jobId: "j1" });
  assert.deepEqual(extracted.recovery, { kind: "edit_job", href: "/jobs/j1" });

  const short = analysisHealthNotice(["job_description_short"], { jobId: "j9" });
  assert.deepEqual(short.recovery, { kind: "edit_job", href: "/jobs/j9" });

  // Without a job id we can't link there; fall back to Refresh.
  const noJob = analysisHealthNotice(["job_not_extracted"], {});
  assert.equal(noJob.recovery.kind, "refresh");
});

test("a model failure outranks a thin job description", () => {
  const notice = analysisHealthNotice(["job_description_short", "module_failed"], { jobId: "j1" });
  assert.equal(notice.recovery.kind, "refresh");
});
