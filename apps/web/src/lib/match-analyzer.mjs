const AI_SKILLS = [
  "python",
  "fastapi",
  "llm",
  "rag",
  "vector database",
  "embeddings",
  "langchain",
  "langgraph",
  "prompt engineering",
  "tool calling",
  "agents",
  "evaluation",
  "docker",
  "aws",
  "gcp",
  "azure",
  "sql",
  "postgres",
  "api design",
  "observability",
  "testing",
  "security",
];

const SENIORITY_TERMS = ["junior", "mid", "senior", "staff", "principal", "lead"];

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\w+#./ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, "i").test(text);
}

function extractSkills(text) {
  const normalized = normalizeText(text);
  return AI_SKILLS.filter((skill) => hasTerm(normalized, skill));
}

function extractYears(text) {
  const normalized = normalizeText(text);
  const matches = [...normalized.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)/g)];
  if (matches.length === 0) {
    return null;
  }

  return Math.max(...matches.map((match) => Number(match[1])).filter(Number.isFinite));
}

function extractSeniority(text) {
  const normalized = normalizeText(text);
  return SENIORITY_TERMS.find((term) => hasTerm(normalized, term)) ?? null;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreCoverage(matchedCount, requiredCount) {
  if (requiredCount === 0) {
    return 70;
  }

  return clampScore((matchedCount / requiredCount) * 100);
}

function scoreExperience(resumeYears, jobYears) {
  if (!jobYears) {
    return resumeYears ? 80 : 65;
  }

  if (!resumeYears) {
    return 45;
  }

  return clampScore((resumeYears / jobYears) * 100);
}

function scoreSeniority(resumeSeniority, jobSeniority) {
  if (!jobSeniority) {
    return 70;
  }

  if (!resumeSeniority) {
    return 50;
  }

  const resumeIndex = SENIORITY_TERMS.indexOf(resumeSeniority);
  const jobIndex = SENIORITY_TERMS.indexOf(jobSeniority);

  if (resumeIndex >= jobIndex) {
    return 90;
  }

  if (jobIndex - resumeIndex === 1) {
    return 65;
  }

  return 40;
}

function categorizeOverallScore(score) {
  if (score >= 90) return "Strong match";
  if (score >= 75) return "Good match";
  if (score >= 60) return "Possible match with gaps";
  if (score >= 40) return "Weak match";
  return "Not recommended yet";
}

function buildMissingSkills(requiredSkills, matchedSkills) {
  return requiredSkills
    .filter((skill) => !matchedSkills.includes(skill))
    .map((skill, index) => ({
      skill,
      severity: index < 3 ? "Critical" : "Medium",
      gap_type: "True Gap",
      why_it_matters: `${skill} appears in the job description but not in the canonical resume text.`,
      suggested_action: `Add real project or work evidence for ${skill} before using it in resume claims.`,
    }));
}

export function analyzeResumeJobFit({ resumeText, jobDescription }) {
  const resumeSkills = extractSkills(resumeText);
  const jobSkills = extractSkills(jobDescription);
  const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingSkills = buildMissingSkills(jobSkills, matchedSkills);
  const resumeYears = extractYears(resumeText);
  const jobYears = extractYears(jobDescription);
  const resumeSeniority = extractSeniority(resumeText);
  const jobSeniority = extractSeniority(jobDescription);

  const skillScore = scoreCoverage(matchedSkills.length, jobSkills.length);
  const aiReadinessScore = scoreCoverage(
    matchedSkills.filter((skill) => AI_SKILLS.slice(0, 12).includes(skill)).length,
    jobSkills.filter((skill) => AI_SKILLS.slice(0, 12).includes(skill)).length
  );
  const atsKeywordScore = scoreCoverage(matchedSkills.length, unique([...jobSkills]).length);
  const experienceScore = scoreExperience(resumeYears, jobYears);
  const seniorityScore = scoreSeniority(resumeSeniority, jobSeniority);
  const overallScore = clampScore(
    skillScore * 0.3 +
      experienceScore * 0.2 +
      aiReadinessScore * 0.25 +
      atsKeywordScore * 0.15 +
      seniorityScore * 0.1
  );

  const strengths = matchedSkills.map((skill) => ({
    skill,
    evidence: `${skill} appears in both the resume and job description.`,
  }));
  const weaknesses =
    missingSkills.length > 0
      ? missingSkills.slice(0, 5).map((gap) => ({
          skill: gap.skill,
          reason: gap.why_it_matters,
        }))
      : [{ skill: "Positioning", reason: "Core job keywords are represented in the resume." }];

  return {
    overall_score: overallScore,
    skill_score: skillScore,
    experience_score: experienceScore,
    ai_readiness_score: aiReadinessScore,
    ats_keyword_score: atsKeywordScore,
    seniority_score: seniorityScore,
    strengths_json: strengths,
    weaknesses_json: weaknesses,
    missing_skills_json: missingSkills,
    risks_json: missingSkills.slice(0, 3).map((gap) => ({
      risk: `${gap.skill} may be screened as missing.`,
      mitigation: gap.suggested_action,
    })),
    explanation_json: {
      category: categorizeOverallScore(overallScore),
      formula:
        "overall = skill*0.30 + experience*0.20 + ai_readiness*0.25 + ats_keyword*0.15 + seniority*0.10",
      matched_skills: matchedSkills,
      resume_years: resumeYears,
      job_years: jobYears,
      resume_seniority: resumeSeniority,
      job_seniority: jobSeniority,
      analyzer: "deterministic-baseline",
    },
    structured_resume: {
      skills: resumeSkills,
      years_of_experience: resumeYears,
      seniority: resumeSeniority,
    },
    structured_job: {
      required_skills: jobSkills,
      years_required: jobYears,
      seniority: jobSeniority,
    },
  };
}
