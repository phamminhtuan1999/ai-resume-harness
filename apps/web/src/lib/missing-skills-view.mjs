/*
  Pure view helpers for the missing-skill analysis (US-029). Grouping,
  normalization, and labels live here so they are unit-testable without
  rendering. The page renders the result of `groupByImportance`.
*/

export const IMPORTANCE_SECTIONS = [
  { key: "critical", label: "Critical" },
  { key: "medium", label: "Medium" },
  { key: "nice_to_have", label: "Nice to have" },
];

export const GAP_TYPE_LABEL = {
  true_gap: "True gap",
  wording_gap: "Wording gap",
  proof_gap: "Proof gap",
};

export const EVIDENCE_LABEL = {
  no_evidence: "No evidence",
  weak_evidence: "Weak evidence",
  strong_evidence: "Strong evidence",
};

const IMPORTANCE_VALUES = new Set(["critical", "medium", "nice_to_have"]);
const GAP_TYPE_VALUES = new Set(["true_gap", "wording_gap", "proof_gap"]);
const EVIDENCE_VALUES = new Set(["no_evidence", "weak_evidence", "strong_evidence"]);

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeMissingSkill(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const skill = str(item.skill);
  if (!skill) {
    return null;
  }
  return {
    skill,
    importance: IMPORTANCE_VALUES.has(item.importance) ? item.importance : "medium",
    gap_type: GAP_TYPE_VALUES.has(item.gap_type) ? item.gap_type : "true_gap",
    evidence_status: EVIDENCE_VALUES.has(item.evidence_status)
      ? item.evidence_status
      : "no_evidence",
    resume_evidence: str(item.resume_evidence),
    job_requirement: str(item.job_requirement),
    why_it_matters: str(item.why_it_matters),
    how_to_fix: str(item.how_to_fix),
    suggested_project_task: str(item.suggested_project_task),
    interview_risk: str(item.interview_risk),
  };
}

export function groupByImportance(skills) {
  const list = Array.isArray(skills)
    ? skills.map(normalizeMissingSkill).filter(Boolean)
    : [];
  return IMPORTANCE_SECTIONS.map((section) => ({
    ...section,
    items: list.filter((item) => item.importance === section.key),
  }));
}
