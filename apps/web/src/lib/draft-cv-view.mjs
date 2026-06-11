/*
  Presentation helpers for the Draft CV review page (US-040). The CV preview must
  show EXACTLY what export will contain, so `isRenderable` mirrors the backend
  gating predicate (app/services/export/render_model.py): a bullet renders iff it
  is safe_to_use or an approved needs_confirmation. `collectReviewBullets` splits
  out the pending needs_confirmation items (the review queue) and the excluded
  ones (do_not_use_yet / rejected) for the warnings panel.
*/

export function isRenderable(bullet) {
  if (!bullet || typeof bullet !== "object") return false;
  const status = bullet.truth_guard_status;
  if (status === "safe_to_use") return true;
  if (status === "needs_confirmation") return bullet.user_action === "approved";
  return false;
}

function renderableTexts(bullets) {
  return (Array.isArray(bullets) ? bullets : [])
    .filter(isRenderable)
    .map((b) => (b.text || "").trim())
    .filter(Boolean);
}

function entriesWith(section, bulletsKey) {
  return (Array.isArray(section) ? section : []).map((entry) => ({
    ...entry,
    bullets: renderableTexts(entry?.[bulletsKey] ?? entry?.bullets),
  }));
}

export function buildDraftCvView(cvJson) {
  const cv = cvJson && typeof cvJson === "object" ? cvJson : {};
  const skills = (Array.isArray(cv.skills) ? cv.skills : []).filter(
    (g) => Array.isArray(g?.items) && g.items.length > 0
  );

  return {
    contact: cv.candidate || {},
    targetJob: cv.target_job || {},
    professionalSummary: (cv.professional_summary || "").trim(),
    skills,
    workExperience: entriesWith(cv.work_experience, "bullets"),
    projects: entriesWith(cv.projects, "bullets"),
    education: Array.isArray(cv.education) ? cv.education : [],
    certifications: Array.isArray(cv.certifications) ? cv.certifications : [],
  };
}

export function collectReviewBullets(cvJson) {
  const cv = cvJson && typeof cvJson === "object" ? cvJson : {};
  const pending = [];
  const excluded = [];

  for (const section of ["work_experience", "projects"]) {
    for (const entry of Array.isArray(cv[section]) ? cv[section] : []) {
      for (const bullet of Array.isArray(entry?.bullets) ? entry.bullets : []) {
        const status = bullet?.truth_guard_status;
        const action = bullet?.user_action || "pending";
        if (status === "needs_confirmation" && action === "pending") {
          pending.push({
            id: bullet.id,
            text: bullet.text || "",
            evidence: bullet.source_evidence || "",
          });
        } else if (status === "do_not_use_yet" || action === "rejected") {
          excluded.push({
            text: bullet.text || "",
            status: action === "rejected" ? "rejected" : "unsupported",
          });
        }
      }
    }
  }
  return { pending, excluded };
}

export function pendingReviewCount(cvJson) {
  return collectReviewBullets(cvJson).pending.length;
}

const STATUS_LABELS = {
  draft: "Draft",
  needs_review: "Needs review",
  ready_to_export: "Ready to export",
  exported: "Exported",
};

export function draftStatusLabel(status) {
  return STATUS_LABELS[status] || "Draft";
}

export function draftStatusVariant(status) {
  if (status === "ready_to_export" || status === "exported") return "secondary";
  if (status === "needs_review") return "warning";
  return "outline";
}

// --- US-046 rendering recommendation + page override ---------------------------

const FONT_PROFILE_LABELS = {
  modern_latex: "Modern LaTeX",
  ats_clean: "ATS Clean",
  classic_latex: "Classic LaTeX",
};

const DENSITY_LABELS = {
  compact: "Compact",
  standard: "Standard",
  spacious: "Spacious",
};

/*
  Project a stored `rendering_json` (US-043) into a view model for the
  recommendation panel. Returns null for legacy drafts (no rendering_json), so
  the page shows the "regenerate" hint instead of a panel. The values are read
  straight from the server-clamped recommendation — never recomputed here.
*/
export function buildRenderingView(renderingJson) {
  if (!renderingJson || typeof renderingJson !== "object") return null;
  const recommendation = renderingJson.recommendation;
  if (!recommendation || typeof recommendation !== "object") return null;

  const policy =
    renderingJson.page_policy && typeof renderingJson.page_policy === "object"
      ? renderingJson.page_policy
      : {};
  const recommendedPages = Number(recommendation.recommended_page_count) || 1;
  const maxPages = Number(policy.max_pages) || recommendedPages;
  const fontProfile = recommendation.font_profile || "modern_latex";
  const density = recommendation.layout_density || "standard";

  return {
    recommendedPages,
    maxPages: Math.max(maxPages, recommendedPages),
    reason: (recommendation.page_count_reason || "").trim(),
    fontProfile,
    fontProfileLabel: FONT_PROFILE_LABELS[fontProfile] || FONT_PROFILE_LABELS.modern_latex,
    density,
    densityLabel: DENSITY_LABELS[density] || DENSITY_LABELS.standard,
    strategy: Array.isArray(recommendation.compression_strategy)
      ? recommendation.compression_strategy.filter((s) => typeof s === "string" && s.trim())
      : [],
    basis: (policy.basis || "").trim(),
  };
}

/* The page-count options offered by the override control: 1..maxPages. */
export function pageOptions(view) {
  if (!view || !view.maxPages) return [];
  return Array.from({ length: view.maxPages }, (_, i) => i + 1);
}

/* The font choices offered by the override control. Mirrors the backend
   registry (app/services/export/fonts.py) — keys must stay in sync. */
export function fontOptions() {
  return Object.entries(FONT_PROFILE_LABELS).map(([key, label]) => ({ key, label }));
}

/* Warning copy when the user picks fewer pages than recommended (brief §8). */
export function overrideWarning(recommendedPages, selectedPages) {
  if (!recommendedPages || !selectedPages) return null;
  if (selectedPages >= recommendedPages) return null;
  const pages = selectedPages === 1 ? "1 page" : `${selectedPages} pages`;
  return `You chose ${pages}; ApplyWise recommends ${recommendedPages}. Some lower-priority detail may be compressed to fit.`;
}

/* Build the export URL with optional page/font overrides (only when they
   differ from the stored recommendation, to keep the default path clean).
   Markdown (US-059) has no pagination or typography, so overrides never apply. */
export function exportUrl(
  apiBaseUrl,
  draftCvId,
  format,
  selectedPages,
  recommendedPages,
  selectedFont,
  recommendedFont
) {
  const base = `${apiBaseUrl}/api/draft-cvs/${draftCvId}/export/${format}`;
  if (format === "markdown") return base;
  const params = [];
  if (selectedPages && selectedPages !== recommendedPages) {
    params.push(`pages=${selectedPages}`);
  }
  if (selectedFont && selectedFont !== recommendedFont) {
    params.push(`font=${selectedFont}`);
  }
  return params.length ? `${base}?${params.join("&")}` : base;
}

/* Download filename for an export: the route format and the file extension
   differ only for Markdown ("markdown" route → ".md" file). */
export function exportFileName(fileSlug, format) {
  const extension = format === "markdown" ? "md" : format;
  return `${fileSlug}.${extension}`;
}

/* Human summary of a compression report (US-045) for the export area. */
export function compressionSummary(report) {
  if (!report || typeof report !== "object" || !report.applied) return null;
  const dropped = Array.isArray(report.dropped) ? report.dropped : [];
  const bulletDrops = dropped.filter((d) => d && d.kind === "bullet").length;
  const projectDrops = dropped.filter((d) => d && d.kind === "project").length;
  const parts = [];
  if (bulletDrops) parts.push(`${bulletDrops} lower-priority bullet${bulletDrops === 1 ? "" : "s"}`);
  if (projectDrops) parts.push(`${projectDrops} project${projectDrops === 1 ? "" : "s"}`);
  if (report.skills_deduped?.length) parts.push("duplicate skills");
  if (report.summary_truncated) parts.push("a shortened summary");
  return {
    overflow: Boolean(report.page_overflow),
    measuredPages: report.measured_pages ?? null,
    pageTarget: report.page_target ?? null,
    condensed: parts,
  };
}
