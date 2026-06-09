/*
  Job-post view model for the job detail page.

  Jobs carry up to two structured payloads: `extraction_json` (the Gemini
  JobExtraction written by URL import — rich) and `structured_json` (the
  deterministic analyzer's `{required_skills, years_required, seniority}` —
  thin). Merge precedence is extraction > structured > job row, so the page
  always renders the richest data available. The overview falls back to the
  first real paragraph of the raw description when the extraction predates the
  `role_summary` field.
*/

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asStrings(value) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(String(item ?? ""))).filter(Boolean)
    : [];
}

const WORK_TYPE_LABELS = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

const EMPLOYMENT_LABELS = {
  "full-time": "Full-time",
  contract: "Contract",
  internship: "Internship",
};

function labelFor(value, labels) {
  if (!value || value === "unknown") {
    return "";
  }
  return labels[value] ?? value;
}

const OVERVIEW_MAX_CHARS = 600;
const OVERVIEW_MIN_PARAGRAPH_CHARS = 80;

/*
  Deterministic overview fallback: the first paragraph of the raw description
  that reads like prose (long enough, not a heading or bullet). Capped at a
  sentence boundary so it never cuts mid-thought.
*/
export function deriveOverviewFromDescription(rawDescription) {
  const text = cleanText(rawDescription);
  if (!text) {
    return "";
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const prose = paragraphs.find(
    (paragraph) =>
      paragraph.length >= OVERVIEW_MIN_PARAGRAPH_CHARS &&
      !/^[#*•\-–|]/.test(paragraph) &&
      !/^[A-Z][A-Za-z &/]+:$/.test(paragraph)
  );
  if (!prose) {
    return "";
  }
  if (prose.length <= OVERVIEW_MAX_CHARS) {
    return prose;
  }

  const clipped = prose.slice(0, OVERVIEW_MAX_CHARS);
  const lastSentenceEnd = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? ")
  );
  if (lastSentenceEnd >= OVERVIEW_MIN_PARAGRAPH_CHARS) {
    return clipped.slice(0, lastSentenceEnd + 1);
  }
  return `${clipped.slice(0, clipped.lastIndexOf(" "))}…`;
}

export function buildJobPostView({ extraction, structured, jobRow } = {}) {
  const rich = extraction && typeof extraction === "object" ? extraction : {};
  const thin = structured && typeof structured === "object" ? structured : {};
  const row = jobRow && typeof jobRow === "object" ? jobRow : {};

  const workType = cleanText(rich.work_type) || cleanText(row.work_type);
  const employmentType =
    cleanText(rich.employment_type) || cleanText(row.employment_type);

  const yearsRequired = Number(thin.years_required);
  const experience =
    cleanText(rich.required_experience_years) ||
    (Number.isFinite(yearsRequired) && yearsRequired > 0
      ? `${yearsRequired}+ years`
      : "");
  const seniority = cleanText(thin.seniority);

  const facts = [
    { label: "Location", value: cleanText(rich.location) || cleanText(row.location) },
    { label: "Work type", value: labelFor(workType, WORK_TYPE_LABELS) },
    { label: "Employment", value: labelFor(employmentType, EMPLOYMENT_LABELS) },
    {
      label: "Salary",
      value: cleanText(rich.salary_range) || cleanText(row.salary_range),
    },
    { label: "Experience", value: experience },
    { label: "Seniority", value: seniority === "unknown" ? "" : seniority },
  ].filter((fact) => fact.value);

  const requiredSkills = asStrings(rich.required_skills);
  const fallbackSkills = requiredSkills.length > 0 ? [] : asStrings(thin.required_skills);

  const overview =
    cleanText(rich.role_summary) || deriveOverviewFromDescription(row.raw_description);

  const confidence = Number(rich.confidence_score);

  const view = {
    overview,
    overview_derived: !cleanText(rich.role_summary) && Boolean(overview),
    about_company: cleanText(rich.about_company),
    facts,
    responsibilities: asStrings(rich.responsibilities),
    required_skills: requiredSkills.length > 0 ? requiredSkills : fallbackSkills,
    preferred_skills: asStrings(rich.preferred_skills),
    ai_requirements: asStrings(rich.ai_related_requirements),
    cloud_requirements: asStrings(rich.cloud_requirements),
    benefits: asStrings(rich.benefits),
    confidence_score: Number.isFinite(confidence) && confidence > 0 ? confidence : null,
  };

  view.has_structured =
    Boolean(view.overview) ||
    view.facts.length > 0 ||
    view.responsibilities.length > 0 ||
    view.required_skills.length > 0 ||
    view.preferred_skills.length > 0 ||
    view.ai_requirements.length > 0 ||
    view.cloud_requirements.length > 0 ||
    view.benefits.length > 0;

  return view;
}
