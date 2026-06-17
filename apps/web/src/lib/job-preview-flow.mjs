/*
  US-076 — URL + Paste JD preview flow.

  Fetch wrappers for the non-saving preview endpoints plus the pure view-model
  helpers the URL/paste forms use to decide what to show before save:
    - validatePasteLength : too-short JD guard (mirrors the API's _MIN_PASTE_CHARS)
    - needsConfirmation    : ask the user to confirm/edit when title/company are blank
    - nonAiWarning         : Section 17 warning state (Add Anyway / Find AI jobs)

  A `fetchImpl` seam keeps the network calls unit-testable.
*/

// Mirror of the API's _MIN_PASTE_CHARS — below this a paste is too thin to extract.
export const MIN_PASTE_CHARS = 40;

// Decision 0025: below 60 a role is not meaningfully AI-related for this path.
const RELEVANCE_THRESHOLD_POSSIBLE = 60;

// --- Fetch wrappers ---

export async function extractJobFromDescription({
  apiBaseUrl,
  fetchImpl = fetch,
  rawDescription,
  title,
  company,
  sessionToken,
}) {
  const lengthCheck = validatePasteLength(rawDescription);
  if (!lengthCheck.ok) {
    return { ok: false, message: lengthCheck.message, tooShort: true };
  }
  if (!apiBaseUrl) {
    return { ok: false, message: "Job preview API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate job preview." };
  }

  return _postPreview({
    apiBaseUrl,
    fetchImpl,
    path: "/api/jobs/extract-from-description",
    sessionToken,
    body: {
      raw_description: rawDescription,
      title: title || null,
      company: company || null,
    },
    failMessage: "Could not extract the job description.",
  });
}

export async function previewJobByUrl({
  apiBaseUrl,
  fetchImpl = fetch,
  sourceUrl,
  sessionToken,
}) {
  const trimmed = (sourceUrl || "").trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a job URL." };
  }
  if (!apiBaseUrl) {
    return { ok: false, message: "Job preview API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate job preview." };
  }

  return _postPreview({
    apiBaseUrl,
    fetchImpl,
    path: "/api/jobs/preview-url",
    sessionToken,
    body: { source_url: trimmed },
    failMessage: "Could not fetch this job page.",
  });
}

async function _postPreview({
  apiBaseUrl,
  fetchImpl,
  path,
  sessionToken,
  body,
  failMessage,
}) {
  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Job preview API could not be reached." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : failMessage;
    return { ok: false, message: detail };
  }

  if (typeof payload !== "object" || payload === null) {
    return { ok: false, message: "Job preview returned invalid data." };
  }

  return { ok: true, preview: payload };
}

// --- View-model helpers ---

/**
 * Guard a pasted description against being too short to extract.
 */
export function validatePasteLength(text) {
  const trimmed = (text || "").trim();
  if (trimmed.length < MIN_PASTE_CHARS) {
    return {
      ok: false,
      message:
        "This job description is too short to analyze. Paste the full posting.",
    };
  }
  return { ok: true };
}

/**
 * True when a key field (title or company) is blank — the UI then asks the user
 * to confirm or edit before saving (Section 9: do not invent missing fields).
 * Mirrors the API's `_needs_confirmation`.
 */
export function needsConfirmation(preview) {
  if (!preview) return true;
  const title = (preview.title || "").trim();
  const company = (preview.company || "").trim();
  return !title || !company;
}

/**
 * Section 17 non-AI warning state. Warns when the relevance check ran and judged
 * the role not meaningfully AI-related (score below the possible threshold, or
 * explicitly not AI-related). Returns the exclude/relevance reason for display.
 */
export function nonAiWarning(aiRelevance, relevanceAvailable = true) {
  if (!relevanceAvailable || !aiRelevance) {
    return { warn: false };
  }
  const score =
    typeof aiRelevance.ai_relevance_score === "number"
      ? aiRelevance.ai_relevance_score
      : 0;
  const isAiRelated =
    aiRelevance.is_ai_related && score >= RELEVANCE_THRESHOLD_POSSIBLE;
  if (isAiRelated) {
    return { warn: false };
  }
  return {
    warn: true,
    reason:
      aiRelevance.relevance_reason ||
      "This role doesn't look like a meaningful AI engineering role for your path.",
  };
}
