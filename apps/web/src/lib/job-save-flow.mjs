/*
  US-077 — Save / Save & Analyze / Open Apply Link flow.

  Pure builders that turn an in-memory search result or URL/paste preview into a
  POST /api/jobs/save-external request body — carrying the AI Role Relevance and
  Candidate Quick Match judgments through to persistence (decision 0026) — plus
  the apply-link enabled/disabled rule. A `fetchImpl` seam keeps the network call
  unit-testable.
*/

const VALID_SOURCES = new Set(["discovered_api", "manual_url", "manual_paste"]);

// --- Fetch wrapper ---

export async function saveExternalJob({
  apiBaseUrl,
  fetchImpl = fetch,
  request,
  sessionToken,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "Job save API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate the save." };
  }
  if (!request || !VALID_SOURCES.has(request.source)) {
    return { ok: false, message: "There's nothing to save yet." };
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/jobs/save-external`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    return { ok: false, message: "Job save API could not be reached." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string" ? payload.detail : "Could not save this job.";
    return { ok: false, message: detail };
  }
  if (typeof payload !== "object" || payload === null || !payload.job_id) {
    return { ok: false, message: "Job save returned invalid data." };
  }
  return { ok: true, job: payload };
}

// --- Request builders ---

/**
 * Build a save-external request from a Search AI Jobs result (US-075). Search
 * results carry external-provider identity and both AI judgments; they have no
 * structured extraction (that only exists on the URL/paste path).
 */
export function buildSaveRequestFromSearchResult(job) {
  const j = job && typeof job === "object" ? job : {};
  return {
    source: "discovered_api",
    title: _str(j.title),
    company: _nullable(j.company),
    location: _nullable(j.location),
    raw_description: _str(j.description),
    external_source: _nullable(j.external_source),
    external_job_id: _nullable(j.external_job_id),
    external_apply_url: _nullable(j.apply_url),
    ai_relevance: j.ai_relevance ?? null,
    quick_match: j.quick_match ?? null,
  };
}

/**
 * Build a save-external request from a URL/paste preview (US-076). `source`
 * defaults from provenance: a normalized/source URL means `manual_url`,
 * otherwise `manual_paste`. `overrides` lets the confirm step send user-edited
 * title/company/location/description (Section 9: the user fills blanks, we
 * never invent them).
 *
 * @param {object} preview
 * @param {{ source?: string, overrides?: Record<string, unknown> }} [options]
 */
export function buildSaveRequestFromPreview(preview, { source, overrides = {} } = {}) {
  const p = preview && typeof preview === "object" ? preview : {};
  const resolvedSource =
    source || (p.normalized_url || p.source_url ? "manual_url" : "manual_paste");
  return {
    source: resolvedSource,
    title: _str(overrides.title ?? p.title),
    company: _nullable(overrides.company ?? p.company),
    location: _nullable(overrides.location ?? p.location),
    work_type: p.work_type || "unknown",
    employment_type: p.employment_type || "unknown",
    salary_range: _nullable(p.salary_range),
    raw_description: _str(overrides.raw_description ?? p.raw_description),
    source_url: _nullable(p.source_url),
    normalized_url: _nullable(p.normalized_url),
    responsibilities: _arr(p.responsibilities),
    required_skills: _arr(p.required_skills),
    preferred_skills: _arr(p.preferred_skills),
    required_experience_years: _nullable(p.required_experience_years),
    ai_related_requirements: _arr(p.ai_related_requirements),
    cloud_requirements: _arr(p.cloud_requirements),
    extraction_confidence:
      typeof p.extraction_confidence === "number" ? p.extraction_confidence : 0,
    ai_relevance: p.ai_relevance ?? null,
  };
}

/**
 * Open Apply Link state (Epic 7.3): enabled only when an apply/source URL is
 * present. Prefers the provider apply link, then the external apply URL, then
 * the source URL.
 */
export function applyLinkState(job) {
  const candidate =
    job && typeof job === "object"
      ? job.apply_url || job.external_apply_url || job.source_url || ""
      : "";
  const url = typeof candidate === "string" ? candidate.trim() : "";
  return { enabled: Boolean(url), url: url || null };
}

function _str(value) {
  return typeof value === "string" ? value : "";
}

function _nullable(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value ?? null;
}

function _arr(value) {
  return Array.isArray(value) ? value : [];
}
