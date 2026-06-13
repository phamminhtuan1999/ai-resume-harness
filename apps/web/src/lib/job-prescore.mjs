/*
  Local job fit pre-score (US-068).

  A deterministic, zero-AI hint for the jobs list: how well a saved job lines up
  with the candidate profile, computed purely from saved structured data. It is
  explicitly NOT the analyzed verdict — it never calls a model, and the UI must
  present it as a muted hint, not a decision label (honest-coach register).

  Pure and dependency-free so the jobs list can score every row server-side with
  no API round trip, and so node:test can pin each signal. The AI quick match
  (US-068 part B) reuses these same signals for its deterministic fallback.
*/

// Tiers, weakest → strongest. "insufficient" means the job lacks the structured
// data to score at all — we show "not enough info", never a fabricated number.
export const PRESCORE_TIERS = ["insufficient", "weak", "promising", "strong"];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\w+#./ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Short, low-signal words that should not count toward title/skill overlap.
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "at",
  "senior", "junior", "staff", "lead", "principal", "mid", "i", "ii", "iii",
  "engineer", "developer", "remote", "hybrid", "onsite",
]);

function tokens(value) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
  );
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

// Merge a job's rich (extraction_json) and thin (structured_json) payloads into
// the structured fields the pre-score needs. Mirrors job-structured-view's
// precedence: extraction > structured > job row.
export function jobStructuredSignals(job = {}) {
  const rich = job.extraction_json && typeof job.extraction_json === "object" ? job.extraction_json : {};
  const thin = job.structured_json && typeof job.structured_json === "object" ? job.structured_json : {};

  const requiredSkills = asList(rich.required_skills).length
    ? asList(rich.required_skills)
    : asList(thin.required_skills);
  const workType = normalize(rich.work_type || job.work_type);
  const location = String(rich.location || job.location || "").trim();
  const seniority = normalize(thin.seniority || rich.seniority);
  const years = Number(rich.required_experience_years ?? thin.years_required);

  return {
    title: String(job.title || "").trim(),
    requiredSkills,
    workType: workType && workType !== "unknown" ? workType : "",
    location,
    seniority: seniority && seniority !== "unknown" ? seniority : "",
    yearsRequired: Number.isFinite(years) && years > 0 ? years : null,
  };
}

function hasStructuredData(signals) {
  return Boolean(
    signals.requiredSkills.length || signals.workType || signals.seniority || signals.yearsRequired
  );
}

// --- individual signals (each returns 0..100) ----------------------------------

export function titleAlignment(jobTitle, profile) {
  const target = tokens(`${profile?.target_role ?? ""} ${profile?.current_role ?? ""}`);
  const title = tokens(jobTitle);
  if (target.size === 0 || title.size === 0) {
    return 55; // no target role to compare — neutral, never a penalty
  }
  const overlap = [...title].filter((word) => target.has(word)).length;
  return clamp((overlap / title.size) * 100);
}

export function skillOverlap(requiredSkills, profile) {
  if (requiredSkills.length === 0) {
    return 60; // structured but skill-less job — mild neutral
  }
  const have = tokens(profile?.technical_background ?? "");
  if (have.size === 0) {
    return 35; // we know the job's skills but nothing about the candidate's
  }
  const matched = requiredSkills.filter((skill) => {
    const skillTokens = tokens(skill);
    return skillTokens.size > 0 && [...skillTokens].every((word) => have.has(word));
  }).length;
  return clamp((matched / requiredSkills.length) * 100);
}

export function locationFit(signals, profile) {
  // Remote roles fit anyone; an explicit remote preference loves them.
  if (signals.workType === "remote") {
    return profile?.location_preference === "remote" ? 100 : 85;
  }
  const pref = normalize(profile?.location_preference);
  if (pref === "remote" && signals.workType && signals.workType !== "remote") {
    return 40; // wants remote, job is on-site/hybrid
  }
  if (!signals.location) {
    return 65; // no location data — neutral
  }
  const here = tokens(`${profile?.location_city ?? ""} ${profile?.location_country ?? ""}`);
  const there = tokens(signals.location);
  if (here.size === 0 || there.size === 0) {
    return 60;
  }
  return [...there].some((word) => here.has(word)) ? 90 : 50;
}

export function seniorityFit(signals, profile) {
  const years = Number(profile?.years_of_experience);
  if (signals.yearsRequired && Number.isFinite(years)) {
    if (years >= signals.yearsRequired) {
      return 90;
    }
    const gap = signals.yearsRequired - years;
    return clamp(90 - gap * 18); // each year short is a penalty
  }
  if (signals.seniority && !Number.isFinite(years)) {
    return 55; // job states a level, we don't know the candidate's
  }
  return 70; // not enough to judge — neutral
}

// --- composite -----------------------------------------------------------------

const TIER_LABELS = {
  strong: "Likely fit",
  promising: "Possible fit",
  weak: "Long shot",
  insufficient: "Not enough info",
};

export function preScoreTierLabel(tier) {
  return TIER_LABELS[tier] ?? TIER_LABELS.insufficient;
}

export function computeJobPreScore({ profile, job } = {}) {
  const signals = jobStructuredSignals(job || {});
  if (!hasStructuredData(signals)) {
    return { tier: "insufficient", score: null, hasStructured: false, reasons: [] };
  }

  const title = titleAlignment(signals.title, profile);
  const skills = skillOverlap(signals.requiredSkills, profile);
  const location = locationFit(signals, profile);
  const seniority = seniorityFit(signals, profile);

  const score = clamp(skills * 0.4 + title * 0.25 + seniority * 0.2 + location * 0.15);
  const tier = score >= 70 ? "strong" : score >= 45 ? "promising" : "weak";

  return {
    tier,
    score,
    hasStructured: true,
    reasons: [
      { label: "Skill overlap", value: skills },
      { label: "Role alignment", value: title },
      { label: "Seniority fit", value: seniority },
      { label: "Location fit", value: location },
    ],
  };
}
