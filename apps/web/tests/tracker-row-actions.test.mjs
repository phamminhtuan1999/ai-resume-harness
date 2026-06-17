import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_NOTE_LABEL,
  TRACKER_MATERIAL_SHORTCUTS,
  buildTrackerRowActions,
  getContactNote,
} from "../src/lib/tracker-row-actions.mjs";

test("a row with no match exposes the job link but no analysis or materials", () => {
  const actions = buildTrackerRowActions({ job_id: "job-1", match_id: null, status: "saved" });
  assert.deepEqual(actions.job, { key: "job", label: "Job detail", href: "/jobs/job-1" });
  assert.equal(actions.analysis, null);
  assert.deepEqual(actions.materials, []);
  assert.equal(actions.hasMatch, false);
});

test("a row with no job_id has no job link", () => {
  const actions = buildTrackerRowActions({ job_id: null, match_id: "m1", status: "applied" });
  assert.equal(actions.job, null);
  assert.equal(actions.analysis.href, "/matches/m1");
});

test("a linked match exposes job analysis plus every material shortcut", () => {
  const actions = buildTrackerRowActions({ job_id: "job-1", match_id: "m1", status: "applied" });
  assert.equal(actions.hasMatch, true);
  assert.equal(actions.analysis.href, "/matches/m1");
  assert.deepEqual(
    actions.materials.map((m) => m.key),
    ["draft_cv", "cover_letter", "interview_prep", "roadmap"]
  );
  assert.deepEqual(
    actions.materials.map((m) => m.href),
    [
      "/matches/m1/draft-cv",
      "/matches/m1/cover-letter",
      "/matches/m1/interview-prep",
      "/matches/m1/roadmap",
    ]
  );
  // Without readiness info every shortcut just routes to its surface.
  assert.ok(actions.materials.every((m) => m.state === "open"));
});

test("artifact readiness annotates existing vs missing materials", () => {
  const actions = buildTrackerRowActions(
    { job_id: "job-1", match_id: "m1", status: "interviewing" },
    { artifacts: { draft_cv: true, cover_letter: false, interview_prep: true } }
  );
  const byKey = Object.fromEntries(actions.materials.map((m) => [m.key, m.state]));
  assert.equal(byKey.draft_cv, "ready"); // exists
  assert.equal(byKey.cover_letter, "generate"); // explicitly absent
  assert.equal(byKey.interview_prep, "ready");
  assert.equal(byKey.roadmap, "generate"); // unset key treated as missing
});

test("a learning target keeps only the roadmap shortcut, prominent", () => {
  const actions = buildTrackerRowActions({
    job_id: "job-1",
    match_id: "m1",
    status: "learning_target",
  });
  assert.equal(actions.isLearningTarget, true);
  // CV / cover-letter / interview-prep would imply an active application.
  assert.deepEqual(
    actions.materials.map((m) => m.key),
    ["roadmap"]
  );
  assert.equal(actions.materials[0].prominent, true);
  assert.equal(actions.materials[0].href, "/matches/m1/roadmap");
  // Analysis is still reachable for the learning target.
  assert.equal(actions.analysis.href, "/matches/m1");
});

test("a learning target with no match has no roadmap shortcut", () => {
  const actions = buildTrackerRowActions({
    job_id: "job-1",
    match_id: null,
    status: "learning_target",
  });
  assert.deepEqual(actions.materials, []);
  assert.equal(actions.analysis, null);
});

test("getContactNote trims and falls back to null", () => {
  assert.equal(getContactNote({ contact_notes: "  Met at the AI meetup  " }), "Met at the AI meetup");
  assert.equal(getContactNote({ contact_notes: "   " }), null);
  assert.equal(getContactNote({ contact_notes: null }), null);
  assert.equal(getContactNote({}), null);
  assert.equal(getContactNote(null), null);
  assert.equal(CONTACT_NOTE_LABEL, "Contact note");
});

test("material shortcut segments stay in sync with the match sub-routes", () => {
  assert.deepEqual(
    TRACKER_MATERIAL_SHORTCUTS.map((s) => s.segment),
    ["draft-cv", "cover-letter", "interview-prep", "roadmap"]
  );
});
