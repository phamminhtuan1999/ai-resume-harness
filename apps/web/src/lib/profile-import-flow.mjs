export async function extractCandidateProfileFromResume({
  apiBaseUrl,
  fetchImpl = fetch,
  resumeId,
  sessionToken,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "Candidate profile import API is not configured." };
  }

  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate candidate profile import." };
  }

  if (!resumeId) {
    return { ok: false, message: "Resume is required before profile import." };
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/resumes/${resumeId}/extract-profile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
  } catch {
    return { ok: false, message: "Candidate profile import API could not be reached." };
  }

  return readProfileImportResponse(response, "Candidate profile extraction failed.");
}

export async function saveImportedCandidateProfile({
  apiBaseUrl,
  candidateProfile,
  confidence,
  fetchImpl = fetch,
  resumeId,
  sessionToken,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "Candidate profile import API is not configured." };
  }

  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate candidate profile import." };
  }

  if (!resumeId || !candidateProfile) {
    return { ok: false, message: "Resume and candidate profile are required." };
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/profile/import-from-resume`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resume_id: resumeId,
        candidate_profile: candidateProfile,
        confidence,
      }),
    });
  } catch {
    return { ok: false, message: "Candidate profile import API could not be reached." };
  }

  return readProfileImportResponse(response, "Candidate profile save failed.");
}

async function readProfileImportResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : fallbackMessage;
    return { ok: false, message: detail };
  }

  if (typeof payload !== "object" || payload === null) {
    return { ok: false, message: "Candidate profile import returned invalid data." };
  }

  return { ok: true, payload };
}
