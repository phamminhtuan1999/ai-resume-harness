/*
  Presentation helpers for the career profile page. Projects the user_profiles
  row + the imported candidate_profile_json (US-019 extraction shape, see
  apps/api/app/schemas/candidate_profile.py) into render-ready view models.
  Pure functions only - the page and components stay markup-only.
*/

// The five fields the targeting form edits, with their user-facing labels.
const TARGETING_FIELDS = [
  ["current_role", "Current role"],
  ["years_of_experience", "Years of experience"],
  ["target_role", "Target role"],
  ["location_preference", "Location preference"],
  ["technical_background", "Technical background"],
];

/* Completeness as plain facts (filled count + what is missing) - the page
   renders text and chips, not a progress bar. */
export function profileCompleteness(profile) {
  const row = profile && typeof profile === "object" ? profile : {};
  const missing = TARGETING_FIELDS.filter(([key]) => {
    const value = row[key];
    if (value === null || value === undefined) return true;
    return String(value).trim() === "";
  }).map(([, label]) => label);
  return {
    filled: TARGETING_FIELDS.length - missing.length,
    total: TARGETING_FIELDS.length,
    missing,
  };
}

const SKILL_GROUP_LABELS = [
  ["programming_languages", "Languages"],
  ["backend", "Backend"],
  ["frontend", "Frontend"],
  ["databases", "Databases"],
  ["cloud_devops", "Cloud & DevOps"],
  ["ai_ml", "AI & ML"],
  ["testing", "Testing"],
  ["accessibility", "Accessibility"],
  ["tools", "Tools"],
];

function cleanList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function dateRange(start, end) {
  const from = (start || "").toString().trim();
  const to = (end || "").toString().trim();
  if (from && to) return `${from} - ${to}`;
  return from || to || "";
}

/* External links from the imported contact block, ready for anchor tags. */
export function candidateLinks(basicInfo) {
  const basic = basicInfo && typeof basicInfo === "object" ? basicInfo : {};
  return [
    ["linkedin_url", "LinkedIn"],
    ["github_url", "GitHub"],
    ["portfolio_url", "Portfolio"],
  ]
    .map(([key, label]) => ({ key, label, href: (basic[key] || "").toString().trim() }))
    .filter((link) => link.href);
}

/*
  Normalize candidate_profile_json for display. Returns null when nothing
  meaningful was imported, so the page can show the import empty state.
*/
export function buildCandidateView(candidateProfileJson) {
  const cp =
    candidateProfileJson && typeof candidateProfileJson === "object"
      ? candidateProfileJson
      : {};
  const basic = cp.basic_info && typeof cp.basic_info === "object" ? cp.basic_info : {};
  const summary = cp.professional_summary || {};
  const skillsRaw = cp.skills && typeof cp.skills === "object" ? cp.skills : {};

  const skillGroups = SKILL_GROUP_LABELS.map(([key, label]) => ({
    key,
    label,
    items: cleanList(skillsRaw[key]),
  })).filter((group) => group.items.length > 0);

  const experience = (Array.isArray(cp.work_experience) ? cp.work_experience : [])
    .map((entry) => ({
      title: (entry?.title || "").trim(),
      company: (entry?.company || "").trim(),
      location: (entry?.location || "").trim(),
      dates: dateRange(entry?.start_date, entry?.end_date),
      highlight: cleanList(entry?.bullet_points)[0] || "",
    }))
    .filter((entry) => entry.title || entry.company);

  const education = (Array.isArray(cp.education) ? cp.education : [])
    .map((entry) => ({
      school: (entry?.school || "").trim(),
      line: [entry?.degree, entry?.field_of_study].map((v) => (v || "").trim()).filter(Boolean).join(", "),
      dates: (entry?.dates || "").toString().trim(),
    }))
    .filter((entry) => entry.school);

  const certifications = (Array.isArray(cp.certifications) ? cp.certifications : [])
    .map((entry) => ({
      name: (entry?.name || "").trim(),
      issuer: (entry?.issuer || "").trim(),
      date: (entry?.date || "").toString().trim(),
    }))
    .filter((entry) => entry.name);

  const view = {
    name: (basic.full_name || "").trim(),
    title: (basic.current_title || "").trim(),
    location: (basic.location || "").trim(),
    email: (basic.email || "").trim(),
    phone: (basic.phone || "").trim(),
    summary: (summary.candidate_summary || "").trim(),
    background: (summary.primary_engineering_background || "").trim(),
    links: candidateLinks(basic),
    skillGroups,
    experience,
    education,
    certifications,
  };

  const hasContent =
    view.name ||
    view.summary ||
    view.links.length ||
    skillGroups.length ||
    experience.length ||
    education.length ||
    certifications.length;
  return hasContent ? view : null;
}

/* The display name for the identity header, in trust order: imported resume
   name, account name, profile email. */
export function displayName(profile, candidateView) {
  const row = profile && typeof profile === "object" ? profile : {};
  return (
    (candidateView?.name || "").trim() ||
    (row.full_name || "").trim() ||
    (row.email || "").trim() ||
    "Your profile"
  );
}

/* Linked workspace counts for the snapshot strip. */
export function workspaceSnapshot(counts) {
  const safe = counts && typeof counts === "object" ? counts : {};
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return [
    { key: "resumes", label: "Resumes", count: n(safe.resumes), href: "/resumes" },
    { key: "jobs", label: "Saved jobs", count: n(safe.jobs), href: "/jobs" },
    { key: "matches", label: "Analyzed jobs", count: n(safe.matches), href: "/matches" },
  ];
}
