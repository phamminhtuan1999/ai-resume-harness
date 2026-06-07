function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function gapSkill(gap, fallback) {
  return cleanText(gap.skill ?? gap.requirement ?? gap.risk, fallback);
}

function gapSeverity(gap) {
  return cleanText(gap.severity, "Medium");
}

function sortGaps(gaps) {
  const rank = { Critical: 0, Medium: 1, "Nice-to-have": 2 };

  return [...gaps].sort((a, b) => {
    const aRank = rank[gapSeverity(a)] ?? 3;
    const bRank = rank[gapSeverity(b)] ?? 3;
    return aRank - bRank;
  });
}

function makeWeek(index, skill, severity, targetRole, company) {
  const week = index + 1;
  const focus = skill || "AI engineering positioning";
  const roleArticle = /^[aeiou]/i.test(targetRole) ? "an" : "a";

  return {
    week,
    goal: `Build credible ${focus} evidence for ${targetRole}.`,
    skills_covered: [focus],
    tasks: [
      `Study production patterns and failure modes for ${focus}.`,
      `Implement a small, testable example that demonstrates ${focus}.`,
      `Write notes on tradeoffs, limitations, and where this applies to ${company}.`,
    ],
    deliverables: [
      `Working ${focus} demo or documented project increment.`,
      "README section explaining design choices and verification.",
    ],
    suggested_project_work: `Extend one portfolio project with ${focus} and a clear before/after result.`,
    resume_bullet_after_completion: `After completing the work, add a truthful bullet about building ${focus} capability for ${roleArticle} ${targetRole} use case.`,
    priority: severity,
  };
}

export function buildFourWeekRoadmap({ job, match, profile }) {
  const missingSkills = sortGaps(asList(match.missing_skills_json));
  const targetRole = cleanText(profile?.target_role ?? job.title, "AI Engineer");
  const company = cleanText(job.company, "the target company");
  const fallbackSkills = [
    "LLM API integration",
    "evaluation",
    "deployment",
    "resume evidence and interview narrative",
  ];

  const weeks = Array.from({ length: 4 }, (_, index) => {
    const gap = missingSkills[index];
    return makeWeek(
      index,
      gap ? gapSkill(gap, fallbackSkills[index]) : fallbackSkills[index],
      gap ? gapSeverity(gap) : "Medium",
      targetRole,
      company
    );
  });

  return {
    title: `4-week ${targetRole} improvement roadmap`,
    roadmap_json: {
      target_role: targetRole,
      company,
      source: "deterministic-baseline",
      weeks,
    },
  };
}
