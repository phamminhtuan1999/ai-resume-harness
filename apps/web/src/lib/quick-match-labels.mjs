// Candidate Quick Match preview labels (Section 15 of the intake spec).
// These are the canonical allowed values for the quick_match_label column on `jobs`.

export const QUICK_MATCH_LABELS = ["strong", "possible", "weak", "limited_data"];

const LABEL_SET = new Set(QUICK_MATCH_LABELS);

export function isQuickMatchLabel(value) {
  return LABEL_SET.has(value);
}

// Unknown / malformed labels coerce to 'limited_data' — the safe unknown state.
export function coerceQuickMatchLabel(value) {
  return isQuickMatchLabel(value) ? value : "limited_data";
}
