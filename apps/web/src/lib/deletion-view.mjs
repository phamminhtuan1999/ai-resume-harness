// Pure view logic for the Period 12 deletion flows (US-055 / US-056,
// decision 0016). Confirm copy must state the blast radius truthfully:
// the counts come from owner-scoped queries, and the cascade wording
// mirrors the FK graph documented in docs/product/data-model.md.

export const DELETION_CONFIRM_PHRASE = "DELETE";

function countNoun(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function matchesClause(matches) {
  if (!matches) {
    return null;
  }
  const pronoun = matches === 1 ? "it" : "them";
  return `its ${countNoun(matches, "match", "matches")} and every analysis generated from ${pronoun}`;
}

export function resumeDeletionSummary(counts) {
  const matches = Number(counts?.matches) || 0;
  const clause = matchesClause(matches);
  const scope = clause
    ? `Permanently deletes this resume, ${clause}.`
    : "Permanently deletes this resume. It has no matches yet.";
  return `${scope} This cannot be undone.`;
}

export function jobDeletionSummary(counts) {
  const matches = Number(counts?.matches) || 0;
  const applications = Number(counts?.applications) || 0;
  const clauses = [];
  const matchClause = matchesClause(matches);
  if (matchClause) {
    clauses.push(matchClause);
  }
  if (applications) {
    clauses.push(`${countNoun(applications, "tracked application", "tracked applications")}`);
  }
  if (clauses.length === 0) {
    return "Permanently deletes this job. It has no matches or tracked applications yet. This cannot be undone.";
  }
  return `Permanently deletes this job, ${clauses.join(" and ")}. This cannot be undone.`;
}

// Audit rows are written before the delete runs (decision 0016 §4), so the
// description records what is about to be removed, in past tense for the feed.
export function resumeDeletionAudit(title, counts) {
  const matches = Number(counts?.matches) || 0;
  const cascade = matches
    ? ` along with ${countNoun(matches, "match", "matches")} and their analyses`
    : "";
  return {
    title: `Deleted resume "${title}"`,
    description: `The resume was permanently deleted${cascade}.`,
  };
}

export function jobDeletionAudit(title, company, counts) {
  const matches = Number(counts?.matches) || 0;
  const applications = Number(counts?.applications) || 0;
  const cascade = [];
  if (matches) {
    cascade.push(`${countNoun(matches, "match", "matches")} and their analyses`);
  }
  if (applications) {
    cascade.push(countNoun(applications, "tracked application", "tracked applications"));
  }
  const suffix = cascade.length ? ` along with ${cascade.join(" and ")}` : "";
  const name = company ? `${title} at ${company}` : title;
  return {
    title: `Deleted job "${name}"`,
    description: `The job was permanently deleted${suffix}.`,
  };
}

// List/grid surfaces (US-058) confirm deletion without first fetching per-row
// impact counts (which would be an N+1 across the table). These summaries are
// count-free but still truthful about the cascade; the detail pages keep the
// precise, count-aware summaries above.
export function resumeDeletionSummaryGeneric() {
  return "Permanently deletes this resume and any matches and analyses generated from it. This cannot be undone.";
}

export function jobDeletionSummaryGeneric() {
  return "Permanently deletes this job and everything tied to it — its matches, their analyses, and any tracked applications. This cannot be undone.";
}

// Account deletion gate (US-056): exact phrase, no trimming — the friction
// is the feature.
export function isDeletionConfirmed(value) {
  return value === DELETION_CONFIRM_PHRASE;
}
