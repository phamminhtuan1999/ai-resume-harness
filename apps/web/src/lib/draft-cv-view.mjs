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

/* Renderable bullets keep their identity + edit state (US-060) so the preview
   can offer in-place editing; the visible text set is still exactly the
   export's. */
function renderableBullets(bullets) {
  return (Array.isArray(bullets) ? bullets : [])
    .filter(isRenderable)
    .filter((b) => (b.text || "").trim())
    .map((b) => ({
      id: b.id ?? null,
      text: (b.text || "").trim(),
      userEdited: Boolean(b.user_edited),
      polished: Boolean(b.polished),
      originalText: b.original_text || "",
      sourceFeedbackId: b.source_feedback_id || null,
      pendingEdit:
        b.pending_edit && typeof b.pending_edit === "object"
          ? {
              userText: b.pending_edit.user_text || "",
              polishedText: b.pending_edit.polished_text || "",
              truthGuardStatus: b.pending_edit.truth_guard_status || "",
              evidenceQuestion: b.pending_edit.evidence_question || null,
            }
          : null,
    }));
}

function entriesWith(section, bulletsKey) {
  return (Array.isArray(section) ? section : []).map((entry) => ({
    ...entry,
    bullets: renderableBullets(entry?.[bulletsKey] ?? entry?.bullets),
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

/* True when a built view (buildDraftCvView output) has anything the user can
   actually review or export: a summary, skills, education, or at least one
   renderable work/project bullet. A draft can be saved with none of these — the
   offline fallback yields an empty CV when the structured profile is empty — and
   the page must say so honestly instead of showing a blank preview with live
   Export buttons over a contentless document. */
export function hasRenderableContent(view) {
  if (!view || typeof view !== "object") return false;
  if ((view.professionalSummary || "").trim()) return true;
  if (Array.isArray(view.skills) && view.skills.length) return true;
  if (Array.isArray(view.education) && view.education.length) return true;
  const hasBullets = (entries) =>
    (Array.isArray(entries) ? entries : []).some(
      (entry) => Array.isArray(entry?.bullets) && entry.bullets.length > 0
    );
  return hasBullets(view.workExperience) || hasBullets(view.projects);
}

/* Serialize a draft CV version into deterministic plain text (one logical line
   per field/bullet) for the Version Diff panel. Mirrors the on-screen preview
   ordering and only includes renderable content (via buildDraftCvView), so the
   diff reflects exactly what changed in the CV the user sees, not internal JSON.
   Two versions serialized this way diff cleanly line- and word-wise. */
export function draftCvToText(cvJson) {
  const v = buildDraftCvView(cvJson);
  const lines = [];
  const push = (value) => {
    if (value != null && String(value).trim() !== "") lines.push(String(value));
  };
  const section = (title) => {
    if (lines.length) lines.push("");
    push(title);
  };

  push(v.contact.full_name);
  const contactBits = [
    v.contact.email,
    v.contact.phone,
    v.contact.location,
    v.contact.linkedin_url,
    v.contact.github_url,
    v.contact.portfolio_url,
  ].filter(Boolean);
  if (contactBits.length) push(contactBits.join(" | "));

  if (v.professionalSummary) {
    section("Professional Summary");
    push(v.professionalSummary);
  }

  if (v.skills.length) {
    section("Skills");
    for (const group of v.skills) {
      push(`${group.category}: ${(group.items || []).join(", ")}`);
    }
  }

  const experience = v.workExperience.filter((entry) => entry.bullets.length);
  if (experience.length) {
    section("Work Experience");
    for (const entry of experience) {
      push([entry.company, entry.title].filter(Boolean).join(" — "));
      push([entry.start_date, entry.end_date].filter(Boolean).join(" – "));
      for (const bullet of entry.bullets) push(`• ${bullet.text}`);
    }
  }

  const projects = v.projects.filter((entry) => entry.bullets.length);
  if (projects.length) {
    section("Projects");
    for (const project of projects) {
      push(project.name);
      if (Array.isArray(project.tech_stack) && project.tech_stack.length) {
        push(project.tech_stack.join(", "));
      }
      for (const bullet of project.bullets) push(`• ${bullet.text}`);
    }
  }

  if (v.education.length) {
    section("Education");
    for (const entry of v.education) {
      push([entry.school, entry.degree, entry.field].filter(Boolean).join(", "));
    }
  }

  if (v.certifications.length) {
    section("Certifications");
    for (const cert of v.certifications) {
      push(
        typeof cert === "string"
          ? cert
          : [cert.name, cert.issuer].filter(Boolean).join(", ")
      );
    }
  }

  return lines.join("\n");
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
            sourceFeedbackId: bullet.source_feedback_id || null,
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

/* Regenerate-preservation conflicts (US-060): finalized bullets whose entry
   the regeneration restructured away. Each needs a keep-mine / take-new
   answer — never a silent loss. */
export function collectPreservationConflicts(cvJson) {
  const cv = cvJson && typeof cvJson === "object" ? cvJson : {};
  return (Array.isArray(cv.preservation_conflicts) ? cv.preservation_conflicts : [])
    .filter((c) => c && typeof c === "object" && c.bullet)
    .map((c) => ({
      bulletId: c.bullet.id ?? "",
      bulletText: c.bullet.text || "",
      entryLabel:
        c.section === "projects"
          ? c.entry?.name || "a project"
          : [c.entry?.title, c.entry?.company].filter(Boolean).join(" — ") ||
            "a previous role",
    }));
}

/* Pair each bullet that carries a source_feedback_id with the tier-1 feedback
   item that produced it (US-061). Powers the final-check side-by-side display
   so information drift between feedback and woven bullet is visible and
   rejectable. Links to unknown/missing suggestions are skipped — the server
   sanitizes ids, so a miss here only means the suggestion list moved on. */
export function collectFeedbackTrace(cvJson, suggestions) {
  const cv = cvJson && typeof cvJson === "object" ? cvJson : {};
  const byId = new Map(
    (Array.isArray(suggestions) ? suggestions : [])
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item])
  );
  const rows = [];
  for (const section of ["work_experience", "projects"]) {
    for (const entry of Array.isArray(cv[section]) ? cv[section] : []) {
      for (const bullet of Array.isArray(entry?.bullets) ? entry.bullets : []) {
        const feedbackId = bullet?.source_feedback_id;
        if (!feedbackId || !byId.has(String(feedbackId))) continue;
        const suggestion = byId.get(String(feedbackId));
        rows.push({
          bulletId: bullet.id ?? null,
          bulletText: bullet.text || "",
          feedbackText: suggestion.suggested_text || "",
          userEdited: Boolean(suggestion.user_edited),
          status: bullet.truth_guard_status || "",
          renderable: isRenderable(bullet),
        });
      }
    }
  }
  return rows;
}

/* Tier-1 responses given AFTER this draft was generated (US-061). Feedback
   shapes the CV at generation time only — an export renders the stored
   version — so a response newer than the draft means the CV on screen does
   not reflect it until a regenerate. Counts any non-pending response
   (accepting adds content; rejecting may invalidate woven content). */
export function staleFeedbackCount(draftCreatedAt, suggestions) {
  const generatedAt = Date.parse(draftCreatedAt ?? "");
  if (!Number.isFinite(generatedAt)) return 0;
  let count = 0;
  for (const row of Array.isArray(suggestions) ? suggestions : []) {
    if (!row || (row.user_action ?? "pending") === "pending") continue;
    const respondedAt = Date.parse(row.updated_at ?? "");
    if (Number.isFinite(respondedAt) && respondedAt > generatedAt) count += 1;
  }
  return count;
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
