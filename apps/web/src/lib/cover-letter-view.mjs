/*
  Cover letter ↔ Tailored CV linkage helpers (US-063, decision 0019). The
  letter is generated from the final Tailored CV, so the card shows which CV
  version produced it and flags when a newer CV version exists — a regenerated
  CV never silently invalidates an existing letter.
*/

/* Status of a letter relative to the latest Tailored CV version.
   Returns null without a letter. `legacy` marks pre-US-063 letters that have
   no source linkage (no staleness claim can be made for them). */
export function letterSourceStatus(letter, latestDraft) {
  if (!letter) return null;
  const sourceId = letter.source_draft_cv_id || null;
  if (!sourceId) {
    return { legacy: true, sourceVersion: null, isStale: false, latestVersion: null };
  }
  return {
    legacy: false,
    sourceVersion: letter.source_draft_cv_version ?? null,
    isStale: Boolean(latestDraft && latestDraft.id !== sourceId),
    latestVersion: latestDraft?.version ?? null,
  };
}
