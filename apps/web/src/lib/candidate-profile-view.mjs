/*
  View normalizer for user_profiles.candidate_profile_json (US-019
  CandidateProfile shape). Produces a render-ready model for the resume/profile
  viewer: identity facts, summary, skills grouped by category, and experience /
  project / education / certification entries.
*/

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asStrings(value) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(String(item ?? ""))).filter(Boolean)
    : [];
}

function asObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

const SKILL_GROUP_LABELS = {
  programming_languages: "Languages",
  backend: "Backend",
  frontend: "Frontend",
  databases: "Databases",
  cloud_devops: "Cloud & DevOps",
  ai_ml: "AI / ML",
  testing: "Testing",
  accessibility: "Accessibility",
  tools: "Tools",
};

export function normalizeCandidateProfile(profileJson) {
  const data = profileJson && typeof profileJson === "object" ? profileJson : {};
  const basic = data.basic_info && typeof data.basic_info === "object" ? data.basic_info : {};
  const summary =
    data.professional_summary && typeof data.professional_summary === "object"
      ? data.professional_summary
      : {};
  const skills = data.skills && typeof data.skills === "object" ? data.skills : {};
  const meta = data.ai_metadata && typeof data.ai_metadata === "object" ? data.ai_metadata : {};

  const facts = [
    { label: "Name", value: cleanText(basic.full_name) },
    { label: "Current title", value: cleanText(basic.current_title) },
    {
      label: "Experience",
      value:
        basic.years_of_experience !== null && basic.years_of_experience !== undefined
          ? `${basic.years_of_experience} year(s)`
          : "",
    },
    { label: "Location", value: cleanText(basic.location) },
    { label: "Email", value: cleanText(basic.email) },
    { label: "Phone", value: cleanText(basic.phone) },
  ].filter((fact) => fact.value);

  const links = [
    { label: "LinkedIn", value: cleanText(basic.linkedin_url) },
    { label: "GitHub", value: cleanText(basic.github_url) },
    { label: "Portfolio", value: cleanText(basic.portfolio_url) },
  ].filter((link) => link.value);

  const skillGroups = Object.entries(SKILL_GROUP_LABELS)
    .map(([key, label]) => ({ key, label, items: asStrings(skills[key]) }))
    .filter((group) => group.items.length > 0);

  const experience = asObjects(data.work_experience).map((item) => ({
    company: cleanText(item.company) || "Company",
    title: cleanText(item.title) || "Role",
    location: cleanText(item.location),
    period: [cleanText(item.start_date), item.is_current_role ? "Present" : cleanText(item.end_date)]
      .filter(Boolean)
      .join(" – "),
    description: cleanText(item.description),
    bullet_points: asStrings(item.bullet_points),
    detected_skills: asStrings(item.detected_skills),
  }));

  const projects = asObjects(data.projects).map((item) => ({
    name: cleanText(item.project_name) || "Project",
    type: cleanText(item.project_type),
    description: cleanText(item.description),
    tech_stack: asStrings(item.tech_stack),
    key_features: asStrings(item.key_features),
    impact: cleanText(item.impact),
    links: asStrings(item.links),
  }));

  const education = asObjects(data.education).map((item) => ({
    school: cleanText(item.school) || "School",
    degree: [cleanText(item.degree), cleanText(item.field_of_study)].filter(Boolean).join(", "),
    dates: cleanText(item.dates),
    details: cleanText(item.details),
  }));

  const certifications = asObjects(data.certifications).map((item) => ({
    name: cleanText(item.name) || "Certification",
    issuer: cleanText(item.issuer),
    date: cleanText(item.date),
  }));

  const overview =
    cleanText(summary.candidate_summary) || cleanText(summary.resume_summary);

  return {
    has_profile:
      facts.length > 0 || skillGroups.length > 0 || experience.length > 0 || Boolean(overview),
    facts,
    links,
    overview,
    background: cleanText(summary.primary_engineering_background),
    seniority: cleanText(summary.seniority_level) || cleanText(meta.seniority_level),
    skill_groups: skillGroups,
    experience,
    projects,
    education,
    certifications,
    strongest_skills: asStrings(meta.strongest_skills),
    suggested_target_roles: asStrings(meta.suggested_target_roles),
    weak_ai_role_areas: asStrings(meta.weak_ai_role_areas),
  };
}
