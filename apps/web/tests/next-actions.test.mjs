import assert from "node:assert/strict";
import test from "node:test";

import {
  actionHref,
  actionScope,
  groupActions,
  isExternalAction,
  isKnownActionType,
  materialWarning,
  needsConfirm,
  trackerActionHelper,
  trackerStatusFor,
} from "../src/lib/next-actions-view.mjs";

const action = (type, placement, priority, extra = {}) => ({
  type,
  label: type,
  priority,
  placement,
  state: "enabled",
  reason: "",
  ...extra,
});

test("groupActions buckets by placement and sorts by priority", () => {
  const groups = groupActions([
    action("generate_cover_letter", "secondary", 11),
    action("generate_draft_cv", "primary", 0),
    action("prepare_interview", "secondary", 10),
    action("view_analysis_details", "advanced", 20),
  ]);
  assert.deepEqual(groups.primary.map((a) => a.type), ["generate_draft_cv"]);
  assert.deepEqual(groups.secondary.map((a) => a.type), [
    "prepare_interview",
    "generate_cover_letter",
  ]);
  assert.deepEqual(groups.advanced.map((a) => a.type), ["view_analysis_details"]);
});

test("an unknown action type is demoted to Advanced even if placed primary", () => {
  const groups = groupActions([action("teleport_to_mars", "primary", 0)]);
  assert.equal(groups.primary.length, 0);
  assert.deepEqual(groups.advanced.map((a) => a.type), ["teleport_to_mars"]);
});

test("an unknown placement value falls back to Advanced", () => {
  const groups = groupActions([action("generate_roadmap", "hero", 0)]);
  assert.equal(groups.primary.length, 0);
  assert.deepEqual(groups.advanced.map((a) => a.type), ["generate_roadmap"]);
});

test("Refresh Analysis is never an action (it is the header utility)", () => {
  assert.equal(isKnownActionType("refresh_analysis"), false);
  assert.equal(isKnownActionType("refresh"), false);
});

test("actionHref resolves each scope correctly", () => {
  assert.equal(actionHref("generate_draft_cv", "m1", null), "/matches/m1/draft-cv");
  assert.equal(actionHref("view_skill_gaps", "m1", null), "/matches/m1/gaps");
  assert.equal(actionHref("update_profile", "m1", null), "/profile");
  assert.equal(actionHref("find_better_matches", "m1", null), "/jobs");
  // US-051 relocated the workflow panel behind the Advanced tab route.
  assert.equal(actionHref("view_analysis_details", "m1", null), "/matches/m1/advanced");
  assert.equal(actionHref("open_apply_link", "m1", "https://jobs.example/role"), "https://jobs.example/role");
  // Apply link only resolves when a job URL exists (agency action otherwise absent).
  assert.equal(actionHref("open_apply_link", "m1", null), null);
  // Tracker mutations and unknown types have no href.
  assert.equal(actionHref("save_to_tracker", "m1", null), null);
  assert.equal(actionHref("teleport_to_mars", "m1", null), null);
});

test("apply-link is the only external scope", () => {
  assert.equal(isExternalAction("open_apply_link"), true);
  assert.equal(isExternalAction("generate_draft_cv"), false);
  assert.equal(actionScope("save_reference"), "tracker");
});

test("needsConfirm gates generate-materials on weak readiness", () => {
  const recommended = { draft_cv: "recommended", cover_letter: "recommended" };
  const warned = { draft_cv: "allowed_with_warning", cover_letter: "not_recommended" };

  assert.equal(needsConfirm("generate_draft_cv", recommended), false);
  assert.equal(needsConfirm("generate_draft_cv", warned), true);
  assert.equal(needsConfirm("generate_cover_letter", recommended), false);
  assert.equal(needsConfirm("generate_cover_letter", warned), true);
  // Generate Materials Anyway only exists on weak decisions — always confirms.
  assert.equal(needsConfirm("generate_materials_anyway", recommended), true);
  // Non-material actions never confirm.
  assert.equal(needsConfirm("prepare_interview", warned), false);
});

test("the material warning names the actual missing skills", () => {
  const two = materialWarning(["RAG", "vector databases", "Kafka"]);
  assert.match(two, /RAG or vector databases/);
  assert.doesNotMatch(two, /several critical/i);

  const one = materialWarning(["RAG"]);
  assert.match(one, /RAG/);

  const none = materialWarning([]);
  assert.match(none, /stretch/i);
});

test("Keep for reference maps to the archived status with helper copy", () => {
  assert.equal(trackerStatusFor("save_reference"), "archived");
  assert.equal(trackerStatusFor("save_to_tracker"), "saved");
  assert.match(trackerActionHelper("save_reference"), /archive/i);
  assert.match(trackerActionHelper("save_reference"), /active application/i);
});

test("Draft CV stays locked-in-primary for the apply_with_improvements fixture", () => {
  // Mirrors the US-047 engine output for apply_with_improvements with no strategy
  // yet: Draft CV is primary but locked — the panel must render it where the
  // package put it, not invent its own mapping.
  const groups = groupActions([
    action("review_resume_strategy", "primary", 0),
    action("generate_resume_suggestions", "primary", 1),
    action("generate_draft_cv", "primary", 2, { state: "locked", reason: "Review your resume strategy first." }),
    action("save_to_tracker", "secondary", 13),
  ]);
  const draft = groups.primary.find((a) => a.type === "generate_draft_cv");
  assert.ok(draft);
  assert.equal(draft.state, "locked");
  assert.match(draft.reason, /resume strategy/i);
});

test("a done generate-action keeps its view-action state when grouped", () => {
  const groups = groupActions([
    action("generate_roadmap", "primary", 0, { state: "done", label: "View 4-Week Roadmap" }),
  ]);
  const roadmap = groups.primary[0];
  assert.equal(roadmap.state, "done");
  assert.match(roadmap.label, /View/);
});
