/*
  View normalizer for jobs.structured_json (US-018 JobExtraction shape).
  Produces a render-ready model for the job detail page: facts (chips) plus
  list sections, so the parsed job is the primary view and the raw description
  becomes a collapsible.
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

export function normalizeStructuredJob(structuredJson, jobRow = {}) {
  const data = structuredJson && typeof structuredJson === "object" ? structuredJson : {};
  const row = jobRow && typeof jobRow === "object" ? jobRow : {};

  const workType = cleanText(data.work_type) || cleanText(row.work_type);
  const employmentType = cleanText(data.employment_type) || cleanText(row.employment_type);
  const confidence = Number(data.confidence_score);

  const facts = [
    { label: "Location", value: cleanText(data.location) || cleanText(row.location) },
    { label: "Work type", value: WORK_TYPE_LABELS[workType] ?? (workType === "unknown" ? "" : workType) },
    {
      label: "Employment",
      value:
        EMPLOYMENT_LABELS[employmentType] ??
        (employmentType === "unknown" ? "" : employmentType),
    },
    { label: "Salary", value: cleanText(data.salary_range) || cleanText(row.salary_range) },
    { label: "Experience", value: cleanText(data.required_experience_years) },
  ].filter((fact) => fact.value);

  const sections = [
    { label: "Responsibilities", items: asStrings(data.responsibilities), style: "list" },
    { label: "Required skills", items: asStrings(data.required_skills), style: "badges" },
    { label: "Preferred skills", items: asStrings(data.preferred_skills), style: "badges" },
    {
      label: "AI-related requirements",
      items: asStrings(data.ai_related_requirements),
      style: "list",
    },
    { label: "Cloud requirements", items: asStrings(data.cloud_requirements), style: "badges" },
  ].filter((section) => section.items.length > 0);

  return {
    has_structured: facts.length > 0 || sections.length > 0,
    facts,
    sections,
    confidence_score: Number.isFinite(confidence) && confidence > 0 ? confidence : null,
  };
}
