/*
  View normalizer for interview prep rows (US-035).

  Accepts both the Feature 7.4 AI column mapping (questions_json holds
  {technical_questions, ai_llm_questions, system_design_questions,
  behavioral_questions} as string arrays; study_plan_json holds {prep_summary};
  answer_guidance_json is an array of guidance items) and the legacy US-011
  deterministic shape (questions_json holds {technical, ai_llm, system_design,
  behavioral} as question objects; answer_guidance_json is an object), so old
  saved preps keep rendering after the upgrade.
*/

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asStrings(value) {
  return Array.isArray(value) ? value.map((item) => cleanText(String(item ?? ""))).filter(Boolean) : [];
}

function questionTexts(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return cleanText(item);
      }
      if (item && typeof item === "object") {
        return cleanText(item.question);
      }
      return "";
    })
    .filter(Boolean);
}

function weakTopicTexts(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return cleanText(item);
      }
      if (item && typeof item === "object") {
        return cleanText(item.topic);
      }
      return "";
    })
    .filter(Boolean);
}

function guidanceItems(value) {
  if (Array.isArray(value)) {
    // Feature 7.4 shape.
    return value
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        question: cleanText(item.question),
        recommended_angle: cleanText(item.recommended_angle),
        resume_evidence_to_use: cleanText(item.resume_evidence_to_use) || null,
        warning: cleanText(item.warning) || null,
      }))
      .filter((item) => item.question);
  }

  if (value && typeof value === "object") {
    // Legacy US-011 shape: map careful topics into guidance cards.
    const careful = Array.isArray(value.topics_to_be_careful_with)
      ? value.topics_to_be_careful_with
      : [];
    return careful
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        question: cleanText(item.topic),
        recommended_angle: cleanText(item.guidance),
        resume_evidence_to_use: null,
        warning: "Treat this topic as study/proof to build before claiming experience.",
      }))
      .filter((item) => item.question);
  }

  return [];
}

export function normalizeInterviewPrep(prepRow) {
  const row = prepRow && typeof prepRow === "object" ? prepRow : {};
  const questions =
    row.questions_json && typeof row.questions_json === "object" ? row.questions_json : {};
  const studyPlan =
    row.study_plan_json && typeof row.study_plan_json === "object" ? row.study_plan_json : {};
  const isLegacy = Array.isArray(row.study_plan_json) || "technical" in questions;

  const legacyPitch =
    row.answer_guidance_json && typeof row.answer_guidance_json === "object" && !Array.isArray(row.answer_guidance_json)
      ? cleanText(row.answer_guidance_json.opening_pitch)
      : "";

  return {
    is_legacy: isLegacy,
    prep_summary: cleanText(studyPlan.prep_summary) || legacyPitch,
    technical_questions: isLegacy
      ? questionTexts(questions.technical)
      : asStrings(questions.technical_questions),
    ai_llm_questions: isLegacy
      ? questionTexts(questions.ai_llm)
      : asStrings(questions.ai_llm_questions),
    system_design_questions: isLegacy
      ? questionTexts(questions.system_design)
      : asStrings(questions.system_design_questions),
    behavioral_questions: isLegacy
      ? questionTexts(questions.behavioral)
      : asStrings(questions.behavioral_questions),
    weak_topics_to_study: weakTopicTexts(row.weak_topics_json),
    answer_guidance: guidanceItems(row.answer_guidance_json),
  };
}
