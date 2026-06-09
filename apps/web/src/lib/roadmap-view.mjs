/*
  View normalizer for roadmap_json (US-034).

  Accepts both the Feature 6.4 AI schema (roadmap_summary,
  recommended_project_theme, weeks[].project_feature / interview_talking_point,
  success_criteria, confidence_score) and the legacy US-010 deterministic shape
  (weeks[].suggested_project_work / priority, no summary sections), so old saved
  roadmaps keep rendering after the upgrade.
*/

function asStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")).filter(Boolean) : [];
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeRoadmap(roadmapJson) {
  const data = roadmapJson && typeof roadmapJson === "object" ? roadmapJson : {};
  const rawWeeks = Array.isArray(data.weeks) ? data.weeks : [];

  const weeks = rawWeeks.map((week, index) => {
    const item = week && typeof week === "object" ? week : {};
    return {
      week: Number(item.week) || index + 1,
      goal: cleanText(item.goal) || "Build stronger job-fit evidence.",
      skills_covered: asStringArray(item.skills_covered),
      tasks: asStringArray(item.tasks),
      deliverables: asStringArray(item.deliverables),
      // 6.4 field with legacy fallback.
      project_feature: cleanText(item.project_feature) || cleanText(item.suggested_project_work),
      resume_bullet_after_completion: cleanText(item.resume_bullet_after_completion),
      interview_talking_point: cleanText(item.interview_talking_point),
    };
  });

  const confidence = Number(data.confidence_score);
  return {
    roadmap_summary: cleanText(data.roadmap_summary),
    recommended_project_theme: cleanText(data.recommended_project_theme),
    weeks,
    success_criteria: asStringArray(data.success_criteria),
    confidence_score: Number.isFinite(confidence) ? confidence : null,
    // Legacy metadata (US-010 rows only).
    target_role: cleanText(data.target_role),
    company: cleanText(data.company),
    is_legacy: !cleanText(data.roadmap_summary) && cleanText(data.source) === "deterministic-baseline",
  };
}

export function resumeBullets(weeks) {
  return (Array.isArray(weeks) ? weeks : [])
    .map((week) => ({
      week: week.week,
      bullet: cleanText(week.resume_bullet_after_completion),
    }))
    .filter((item) => item.bullet);
}
