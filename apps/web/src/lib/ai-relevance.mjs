// AI Role Relevance domain values (Section 13 of the intake spec).
// These are the canonical allowed values for the ai_role_category,
// ai_relevance_label, and transition_friendliness columns on `jobs`.

// --- ai_role_category ---

export const AI_ROLE_CATEGORIES = [
  "applied_ai_engineer",
  "llm_engineer",
  "generative_ai_engineer",
  "ai_product_engineer",
  "ai_platform_engineer",
  "backend_ai_engineer",
  "fullstack_ai_engineer",
  "ml_engineer",
  "ml_research",
  "ai_adjacent_engineering",
  "not_ai_engineering",
  "non_engineering_ai",
  "unknown",
];

const CATEGORY_SET = new Set(AI_ROLE_CATEGORIES);

export function isAiRoleCategory(value) {
  return CATEGORY_SET.has(value);
}

export function coerceAiRoleCategory(value) {
  return isAiRoleCategory(value) ? value : "unknown";
}

// --- transition_friendliness ---

export const TRANSITION_FRIENDLINESS_VALUES = ["high", "medium", "low"];

const FRIENDLINESS_SET = new Set(TRANSITION_FRIENDLINESS_VALUES);

export function isTransitionFriendliness(value) {
  return FRIENDLINESS_SET.has(value);
}

export function coerceTransitionFriendliness(value) {
  return isTransitionFriendliness(value) ? value : "low";
}

// --- ai_relevance_label (derived from score thresholds, decision 0025) ---

export const AI_RELEVANCE_LABELS = ["strong", "possible", "hidden"];

export const RELEVANCE_THRESHOLD_STRONG = 75;
export const RELEVANCE_THRESHOLD_POSSIBLE = 60;

export function aiRelevanceLabelFromScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "hidden";
  if (score >= RELEVANCE_THRESHOLD_STRONG) return "strong";
  if (score >= RELEVANCE_THRESHOLD_POSSIBLE) return "possible";
  return "hidden";
}
