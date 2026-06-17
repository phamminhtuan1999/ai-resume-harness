// Canonical job intake source taxonomy (decision 0027).
// These are the only values the DB check constraint accepts.

export const JOB_SOURCES = ["discovered_api", "manual_url", "manual_paste"];

const SOURCE_SET = new Set(JOB_SOURCES);

export const DEFAULT_JOB_SOURCE = "manual_paste";

export function isJobSource(value) {
  return SOURCE_SET.has(value);
}

export function coerceJobSource(value) {
  return isJobSource(value) ? value : DEFAULT_JOB_SOURCE;
}
