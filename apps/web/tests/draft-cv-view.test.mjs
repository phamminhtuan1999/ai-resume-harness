import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftCvView,
  buildRenderingView,
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
  assert.deepEqual(bullets, ["safe one", "approved one"]);
  assert.deepEqual(
    view.skills.map((g) => g.category),
    ["Backend"]
  );
  assert.equal(view.professionalSummary, "Summary line.");
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
