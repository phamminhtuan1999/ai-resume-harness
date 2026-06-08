// Shared dirty-state helpers for edit forms. A "Save"/"Update" action should stay
// disabled until the user actually changes a value, so we compare the current
// form values against the loaded baseline. Values are normalized (nullish -> "",
// trimmed) so cosmetic differences do not count as edits.

export function normalizeFieldValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

export function valuesDiffer(baseline, current) {
  const keys = new Set([
    ...Object.keys(baseline ?? {}),
    ...Object.keys(current ?? {}),
  ]);

  for (const key of keys) {
    if (normalizeFieldValue(baseline?.[key]) !== normalizeFieldValue(current?.[key])) {
      return true;
    }
  }

  return false;
}
