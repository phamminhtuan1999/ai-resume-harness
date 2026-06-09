/*
  Calls the backend job-URL importer (apps/api POST /api/jobs/import-url) and
  normalizes the result into the action `{ ok, ... }` shape. Mirrors
  resume-import-flow: a `fetchImpl` seam keeps it unit-testable without network.
*/
export async function importJobByUrl({
  apiBaseUrl,
  fetchImpl = fetch,
  sourceUrl,
  sessionToken,
}) {
  const trimmed = (sourceUrl || "").trim();
  if (!trimmed) {
    return {
      ok: false,
      message: "Enter a job URL.",
      fieldErrors: { source_url: "Enter a job URL." },
    };
  }

  if (!apiBaseUrl) {
    return { ok: false, message: "Job import API is not configured." };
  }

  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate job import." };
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/jobs/import-url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source_url: trimmed }),
    });
  } catch {
    return { ok: false, message: "Job import API could not be reached." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : "Job import failed.";
    return { ok: false, message: detail };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.job_id !== "string"
  ) {
    return { ok: false, message: "Job import returned invalid data." };
  }

  return { ok: true, job: payload };
}
