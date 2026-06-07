function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function itemText(item, fallback) {
  return cleanText(
    item.skill ??
      item.requirement ??
      item.risk ??
      item.reason ??
      item.evidence ??
      item.topic,
    fallback
  );
}

function detailText(item, fallback = "") {
  return cleanText(
    item.reason ??
      item.evidence ??
      item.why_it_matters ??
      item.mitigation ??
      item.suggested_action,
    fallback
  );
}

function firstOrFallback(items, fallback) {
  return items.length > 0 ? items[0] : fallback;
}

function makeQuestion(category, question, focus, evidence, guardrail) {
  return {
    category,
    question,
    focus,
    answer_framing: evidence
      ? `Anchor the answer in this resume evidence: ${evidence}`
      : "Frame the answer as a learning plan and avoid claiming unsupported experience.",
    evidence,
    guardrail,
  };
}

function weakTopicFromGap(gap, index, company) {
  const topic = itemText(gap, `Interview gap ${index + 1}`);
  const why = detailText(gap, `${company} may probe this because it appeared in the job gap analysis.`);

  return {
    topic,
    severity: cleanText(gap.severity, "Medium"),
    why_it_matters: why,
    study_action: `Review core concepts, failure modes, and tradeoffs for ${topic}.`,
    proof_to_build: `Build proof with a small example that demonstrates ${topic}; say you are still building proof if it is not already in the resume.`,
  };
}

export function buildInterviewPrep({ job, match, resume }) {
  const company = cleanText(job.company, "the target company");
  const role = cleanText(job.title, "the target role");
  const roleArticle = /^[aeiou]/i.test(role) ? "an" : "a";
  const strengths = asList(match.strengths_json);
  const weaknesses = asList(match.weaknesses_json);
  const missingSkills = asList(match.missing_skills_json);
  const risks = asList(match.risks_json);

  const topStrength = firstOrFallback(strengths.map((item) => itemText(item, "")), "saved resume evidence");
  const topWeakness = firstOrFallback(
    weaknesses.map((item) => itemText(item, "")),
    "role-specific depth"
  );
  const topMissing = firstOrFallback(
    missingSkills.map((item) => itemText(item, "")),
    "AI engineering depth"
  );
  const topRisk = firstOrFallback(risks.map((item) => itemText(item, "")), "screening concerns");
  const resumeEvidence = cleanText(resume.raw_text, "").slice(0, 220);

  const questions_json = {
    technical: [
      makeQuestion(
        "technical",
        `How have you used ${topStrength} in a production or project setting?`,
        topStrength,
        topStrength,
        "Use only examples already present in the resume."
      ),
      makeQuestion(
        "technical",
        `What would you do if ${topWeakness} came up during implementation?`,
        topWeakness,
        "",
        "Describe investigation and learning steps when resume evidence is thin."
      ),
    ],
    ai_llm: [
      makeQuestion(
        "ai_llm",
        `How would you evaluate an AI feature for ${role} at ${company}?`,
        "AI evaluation",
        topStrength,
        "Tie the answer to measurable behavior instead of broad AI claims."
      ),
      makeQuestion(
        "ai_llm",
        `What is your plan to close the ${topMissing} gap?`,
        topMissing,
        "",
        "State what needs study or proof before claiming hands-on experience."
      ),
    ],
    system_design: [
      makeQuestion(
        "system_design",
        `Design a reliable workflow for an AI resume or job matching feature for ${company}.`,
        "system design",
        resumeEvidence,
        "Use resume-backed architecture experience and call out unknowns."
      ),
      makeQuestion(
        "system_design",
        `How would you monitor quality, latency, and regressions for an AI service supporting ${roleArticle} ${role}?`,
        "observability",
        topStrength,
        "Prefer concrete checks, logs, and rollback plans."
      ),
    ],
    behavioral: [
      makeQuestion(
        "behavioral",
        `Tell me about a time you learned a missing skill quickly for a project.`,
        topMissing,
        "",
        "Do not imply prior professional experience; explain the learning loop."
      ),
      makeQuestion(
        "behavioral",
        `How would you address ${topRisk} if the interviewer asks about it directly?`,
        topRisk,
        "",
        "Acknowledge the risk and pivot to evidence, study plan, or proof built."
      ),
    ],
  };

  const weak_topics_json = missingSkills.length > 0
    ? missingSkills.slice(0, 5).map((gap, index) => weakTopicFromGap(gap, index, company))
    : [
        {
          topic: "Interview evidence depth",
          severity: "Medium",
          why_it_matters: "The match has limited explicit missing-skill data.",
          study_action: "Review the job description and prepare concrete resume-backed examples.",
          proof_to_build: "Build one small project artifact before claiming new experience.",
        },
      ];

  const study_plan_json = [
    {
      phase: "Day 1",
      focus: "Evidence inventory",
      tasks: [
        `Map resume evidence to ${role} requirements at ${company}.`,
        "Mark every unsupported topic as study/proof needed.",
      ],
    },
    {
      phase: "Days 2-3",
      focus: "Gap practice",
      tasks: weak_topics_json.slice(0, 3).map((topic) => topic.study_action),
    },
    {
      phase: "Day 4",
      focus: "Answer rehearsal",
      tasks: [
        "Practice technical, AI/LLM, system design, and behavioral answers aloud.",
        "Rewrite any answer that sounds like unsupported experience.",
      ],
    },
  ];

  const answer_guidance_json = {
    source: "deterministic-baseline",
    opening_pitch: `Position yourself for ${role} at ${company} using concrete resume evidence first, then explain how you are closing gaps.`,
    evidence_to_use: strengths.slice(0, 5).map((item) => ({
      topic: itemText(item, "Resume strength"),
      framing: detailText(item, "Use this as a supported interview example."),
    })),
    topics_to_be_careful_with: weak_topics_json.map((topic) => ({
      topic: topic.topic,
      guidance: `Treat ${topic.topic} as study/proof to build unless the resume already contains specific evidence.`,
    })),
    closing_questions: [
      `What would success look like for this ${role} in the first 90 days?`,
      `Which AI quality or reliability problems is ${company} prioritizing now?`,
    ],
  };

  return {
    questions_json,
    weak_topics_json,
    study_plan_json,
    answer_guidance_json,
  };
}
