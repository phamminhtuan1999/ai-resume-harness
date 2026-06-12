import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftCvView,
  buildRenderingView,
  collectFeedbackTrace,
  collectPreservationConflicts,
  collectReviewBullets,
  compressionSummary,
  draftStatusLabel,
  draftStatusVariant,
  exportFileName,
  exportUrl,
  fontOptions,
  isRenderable,
  overrideWarning,
  pageOptions,
  pendingReviewCount,
  staleFeedbackCount,
} from "../src/lib/draft-cv-view.mjs";

function bullet(text, status, action = "pending") {
  return {
    id: `b-${text}`,
    text,
    source_evidence: "ev",
    truth_guard_status: status,
    user_action: action,
  };
}

function cvJson() {
  return {
    candidate: { full_name: "Dana Engineer", email: "dana@example.com" },
    professional_summary: "Summary line.",
    skills: [
      { category: "Backend", items: ["FastAPI"] },
      { category: "Empty", items: [] },
    ],
    work_experience: [
      {
        company: "Acme",
        title: "Engineer",
        bullets: [
          bullet("safe one", "safe_to_use"),
          bullet("approved one", "needs_confirmation", "approved"),
          bullet("pending one", "needs_confirmation", "pending"),
          bullet("rejected one", "needs_confirmation", "rejected"),
          bullet("forbidden one", "do_not_use_yet"),
        ],
      },
    ],
    projects: [],
    education: [{ school: "State U", degree: "BSc", field: "CS" }],
  };
}

test("isRenderable mirrors the backend gate", () => {
  assert.equal(isRenderable(bullet("x", "safe_to_use")), true);
  assert.equal(isRenderable(bullet("x", "needs_confirmation", "approved")), true);
  assert.equal(isRenderable(bullet("x", "needs_confirmation", "pending")), false);
  assert.equal(isRenderable(bullet("x", "needs_confirmation", "rejected")), false);
  assert.equal(isRenderable(bullet("x", "do_not_use_yet")), false);
});

test("buildDraftCvView shows only renderable bullets and drops empty skill groups", () => {
  const view = buildDraftCvView(cvJson());
  const bullets = view.workExperience[0].bullets;
  // US-060: bullets keep identity + edit state for in-place editing, but the
  // visible text set is still exactly the export's.
  assert.deepEqual(
    bullets.map((b) => b.text),
    ["safe one", "approved one"]
  );
  assert.ok(bullets.every((b) => typeof b.id === "string"));
  assert.ok(bullets.every((b) => b.pendingEdit === null));
  assert.deepEqual(
    view.skills.map((g) => g.category),
    ["Backend"]
  );
  assert.equal(view.professionalSummary, "Summary line.");
});

test("buildDraftCvView surfaces edit state and a staged pending edit (US-060)", () => {
  const cv = cvJson();
  Object.assign(cv.work_experience[0].bullets[0], {
    user_edited: true,
    polished: true,
    original_text: "previous wording",
    pending_edit: {
      user_text: "my text",
      polished_text: "polished text",
      truth_guard_status: "needs_confirmation",
      evidence_question: "What proves it?",
    },
  });
  const bullet = buildDraftCvView(cv).workExperience[0].bullets[0];
  assert.equal(bullet.userEdited, true);
  assert.equal(bullet.polished, true);
  assert.equal(bullet.originalText, "previous wording");
  assert.deepEqual(bullet.pendingEdit, {
    userText: "my text",
    polishedText: "polished text",
    truthGuardStatus: "needs_confirmation",
    evidenceQuestion: "What proves it?",
  });
});

test("collectPreservationConflicts labels each keep/take prompt (US-060)", () => {
  const cv = cvJson();
  cv.preservation_conflicts = [
    {
      section: "work_experience",
      entry: { company: "OldCo", title: "Engineer" },
      bullet: { id: "old1", text: "Kept work." },
    },
    {
      section: "projects",
      entry: { name: "Sidekick" },
      bullet: { id: "old2", text: "Project bullet." },
    },
  ];
  const conflicts = collectPreservationConflicts(cv);
  assert.deepEqual(
    conflicts.map((c) => c.entryLabel),
    ["Engineer — OldCo", "Sidekick"]
  );
  assert.deepEqual(
    conflicts.map((c) => c.bulletId),
    ["old1", "old2"]
  );
  assert.deepEqual(collectPreservationConflicts(cvJson()), []);
});

test("collectReviewBullets splits pending and excluded", () => {
  const { pending, excluded } = collectReviewBullets(cvJson());
  assert.deepEqual(
    pending.map((b) => b.text),
    ["pending one"]
  );
  assert.deepEqual(
    excluded.map((b) => b.text).sort(),
    ["forbidden one", "rejected one"]
  );
  assert.equal(pendingReviewCount(cvJson()), 1);
});

test("status label and variant map known statuses", () => {
  assert.equal(draftStatusLabel("ready_to_export"), "Ready to export");
  assert.equal(draftStatusLabel("needs_review"), "Needs review");
  assert.equal(draftStatusVariant("needs_review"), "warning");
  assert.equal(draftStatusVariant("exported"), "secondary");
});

test("handles missing/empty cv json without throwing", () => {
  const view = buildDraftCvView(null);
  assert.deepEqual(view.skills, []);
  assert.deepEqual(view.workExperience, []);
  assert.equal(pendingReviewCount(undefined), 0);
});

// --- US-046 rendering recommendation + override --------------------------------

function renderingJson(overrides = {}) {
  return {
    recommendation: {
      recommended_page_count: 1,
      page_count_reason: "Concise one-pager for a mid-level role.",
      font_profile: "modern_latex",
      layout_density: "compact",
      compression_strategy: ["Prioritize backend work", "Condense older roles"],
      ...overrides.recommendation,
    },
    page_policy: { max_pages: 2, basis: "6 years of experience", ...overrides.page_policy },
  };
}

test("buildRenderingView maps a stored recommendation", () => {
  const view = buildRenderingView(renderingJson());
  assert.equal(view.recommendedPages, 1);
  assert.equal(view.maxPages, 2);
  assert.equal(view.fontProfileLabel, "Modern LaTeX");
  assert.equal(view.densityLabel, "Compact");
  assert.equal(view.reason, "Concise one-pager for a mid-level role.");
  assert.equal(view.strategy.length, 2);
});

test("buildRenderingView returns null for legacy drafts", () => {
  assert.equal(buildRenderingView(null), null);
  assert.equal(buildRenderingView({}), null);
  assert.equal(buildRenderingView({ page_policy: {} }), null); // no recommendation
});

test("buildRenderingView falls back when policy max is missing", () => {
  const view = buildRenderingView(
    renderingJson({ recommendation: { recommended_page_count: 2 }, page_policy: {} })
  );
  assert.equal(view.recommendedPages, 2);
  assert.equal(view.maxPages, 2); // never below the recommendation
  assert.equal(view.fontProfileLabel, "Modern LaTeX");
});

test("pageOptions lists 1..maxPages", () => {
  assert.deepEqual(pageOptions(buildRenderingView(renderingJson())), [1, 2]);
  assert.deepEqual(pageOptions(null), []);
});

test("overrideWarning only warns below the recommendation", () => {
  assert.equal(overrideWarning(2, 2), null);
  assert.equal(overrideWarning(1, 2), null); // above recommendation, no warning
  assert.match(overrideWarning(2, 1), /recommends 2/);
});

test("exportUrl appends pages only when overriding the recommendation", () => {
  const base = "https://api.test";
  assert.equal(
    exportUrl(base, "d1", "pdf", 1, 1),
    "https://api.test/api/draft-cvs/d1/export/pdf"
  );
  assert.equal(
    exportUrl(base, "d1", "pdf", 2, 1),
    "https://api.test/api/draft-cvs/d1/export/pdf?pages=2"
  );
});

test("exportUrl appends font only when overriding the stored profile", () => {
  const base = "https://api.test";
  assert.equal(
    exportUrl(base, "d1", "pdf", 1, 1, "ats_clean", "ats_clean"),
    "https://api.test/api/draft-cvs/d1/export/pdf"
  );
  assert.equal(
    exportUrl(base, "d1", "pdf", 1, 1, "modern_latex", "ats_clean"),
    "https://api.test/api/draft-cvs/d1/export/pdf?font=modern_latex"
  );
  // Both overrides combine into one query string.
  assert.equal(
    exportUrl(base, "d1", "docx", 2, 1, "classic_latex", "ats_clean"),
    "https://api.test/api/draft-cvs/d1/export/docx?pages=2&font=classic_latex"
  );
});

test("exportUrl never appends overrides for markdown (US-059)", () => {
  assert.equal(
    exportUrl("https://api.test", "d1", "markdown", 2, 1, "classic_latex", "ats_clean"),
    "https://api.test/api/draft-cvs/d1/export/markdown"
  );
});

test("exportFileName maps the markdown route to a .md file", () => {
  assert.equal(exportFileName("dana-acme", "pdf"), "dana-acme.pdf");
  assert.equal(exportFileName("dana-acme", "docx"), "dana-acme.docx");
  assert.equal(exportFileName("dana-acme", "markdown"), "dana-acme.md");
});

test("fontOptions lists the three profiles with display labels", () => {
  assert.deepEqual(fontOptions(), [
    { key: "modern_latex", label: "Modern LaTeX" },
    { key: "ats_clean", label: "ATS Clean" },
    { key: "classic_latex", label: "Classic LaTeX" },
  ]);
});

test("compressionSummary summarizes an applied report", () => {
  const summary = compressionSummary({
    applied: true,
    page_target: 1,
    measured_pages: 1,
    page_overflow: false,
    dropped: [
      { kind: "bullet", text: "x" },
      { kind: "bullet", text: "y" },
      { kind: "project", text: "p" },
    ],
    skills_deduped: ["FastAPI"],
    summary_truncated: true,
  });
  assert.equal(summary.condensed.length, 4); // bullets, project, skills, summary
  assert.equal(summary.overflow, false);
  // A no-op / missing report yields null.
  assert.equal(compressionSummary({ applied: false }), null);
  assert.equal(compressionSummary(null), null);
});

test("collectReviewBullets carries the feedback link for provenance chips (US-061)", () => {
  const cv = cvJson();
  cv.work_experience[0].bullets[0].truth_guard_status = "needs_confirmation";
  cv.work_experience[0].bullets[0].user_action = "pending";
  cv.work_experience[0].bullets[0].source_feedback_id = "sug-9";
  const { pending } = collectReviewBullets(cv);
  const linked = pending.find((b) => b.sourceFeedbackId === "sug-9");
  assert.ok(linked);
  // A bullet without a link reports null, never undefined.
  assert.ok(pending.every((b) => b.sourceFeedbackId !== undefined));
});

test("collectFeedbackTrace pairs bullets with their feedback side by side (US-061)", () => {
  const cv = cvJson();
  cv.work_experience[0].bullets[0].source_feedback_id = "sug-1";
  cv.work_experience[0].bullets[1].source_feedback_id = "ghost"; // unknown id -> skipped
  const suggestions = [
    { id: "sug-1", suggested_text: "Shipped the payments migration.", user_edited: true },
    { id: "sug-2", suggested_text: "Unused feedback.", user_edited: false },
  ];
  const rows = collectFeedbackTrace(cv, suggestions);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].feedbackText, "Shipped the payments migration.");
  assert.equal(rows[0].userEdited, true);
  assert.equal(rows[0].bulletText, cv.work_experience[0].bullets[0].text);
  assert.equal(typeof rows[0].renderable, "boolean");
});

test("collectFeedbackTrace is empty without links or suggestions", () => {
  assert.deepEqual(collectFeedbackTrace(cvJson(), []), []);
  assert.deepEqual(collectFeedbackTrace(null, null), []);
});

test("staleFeedbackCount counts responses given after the draft was generated", () => {
  const draftCreatedAt = "2026-06-10T13:30:00Z";
  const suggestions = [
    // Responded before generation -> woven in, not stale.
    { user_action: "accepted", updated_at: "2026-06-10T12:30:00Z" },
    // Responded after generation -> not in the CV yet.
    { user_action: "accepted", updated_at: "2026-06-10T14:00:00Z" },
    // Rejected after generation also counts (woven content may be invalidated).
    { user_action: "rejected", updated_at: "2026-06-10T15:00:00Z" },
    // Pending responses never count, whatever their timestamp.
    { user_action: "pending", updated_at: "2026-06-10T16:00:00Z" },
  ];
  assert.equal(staleFeedbackCount(draftCreatedAt, suggestions), 2);
});

test("staleFeedbackCount is 0 without a draft timestamp or suggestions", () => {
  assert.equal(staleFeedbackCount(null, [{ user_action: "accepted", updated_at: "2026-06-10T14:00:00Z" }]), 0);
  assert.equal(staleFeedbackCount("not-a-date", []), 0);
  assert.equal(staleFeedbackCount("2026-06-10T13:30:00Z", null), 0);
});
