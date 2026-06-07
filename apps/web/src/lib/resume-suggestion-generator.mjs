const TRUTH_SAFE = "Safe to use";
const TRUTH_CONFIRM = "Needs confirmation";
const TRUTH_BLOCKED = "Do not use yet";

function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function skillLabel(item) {
  return cleanText(item.skill ?? item.requirement ?? item.risk, "Positioning");
}

function evidenceText(item) {
  return cleanText(item.evidence ?? item.reason ?? item.why_it_matters);
}

export function buildResumeSuggestions({ match }) {
  const strengths = asList(match.strengths_json);
  const weaknesses = asList(match.weaknesses_json);
  const missingSkills = asList(match.missing_skills_json);

  const safeSuggestions = strengths.slice(0, 4).map((strength) => {
    const skill = skillLabel(strength);

    return {
      original_text: null,
      suggested_text: `Clarify existing ${skill} impact with a concrete result, system, or project outcome already supported by the resume.`,
      suggestion_type: "positioning",
      related_job_requirement: skill,
      evidence: evidenceText(strength) || `${skill} appears in both the resume and job description.`,
      truth_guard_status: TRUTH_SAFE,
      reason: `The match analyzer found resume evidence for ${skill}, so wording can be improved without adding unsupported facts.`,
      user_action: "pending",
    };
  });

  const confirmationSuggestions = weaknesses.slice(0, 3).map((weakness) => {
    const skill = skillLabel(weakness);

    return {
      original_text: null,
      suggested_text: `Review whether your existing work can honestly show stronger ${skill} evidence before changing the resume.`,
      suggestion_type: "evidence-review",
      related_job_requirement: skill,
      evidence: evidenceText(weakness) || "The match analyzer marked this as a weak positioning area.",
      truth_guard_status: TRUTH_CONFIRM,
      reason: "The resume may have related experience, but the current canonical text does not clearly prove it.",
      user_action: "pending",
    };
  });

  const blockedSuggestions = missingSkills.slice(0, 6).map((gap) => {
    const skill = skillLabel(gap);

    return {
      original_text: null,
      suggested_text: `Do not claim ${skill} yet. Build or document real evidence first, then add a truthful resume bullet.`,
      suggestion_type: "truth-guard-gap",
      related_job_requirement: skill,
      evidence: evidenceText(gap) || `${skill} is required by the job but missing from the resume evidence.`,
      truth_guard_status: TRUTH_BLOCKED,
      reason: "Adding this claim now would create unsupported resume content.",
      user_action: "pending",
    };
  });

  const suggestions = [...safeSuggestions, ...confirmationSuggestions, ...blockedSuggestions];

  if (suggestions.length > 0) {
    return suggestions;
  }

  return [
    {
      original_text: null,
      suggested_text:
        "Tighten one existing resume bullet by adding scope, production context, and measurable outcome already present in your experience.",
      suggestion_type: "positioning",
      related_job_requirement: "General role fit",
      evidence: "No missing skills or shared skill signals were available in the deterministic baseline.",
      truth_guard_status: TRUTH_CONFIRM,
      reason: "The app needs stronger parsed evidence before marking a specific suggestion safe.",
      user_action: "pending",
    },
  ];
}
