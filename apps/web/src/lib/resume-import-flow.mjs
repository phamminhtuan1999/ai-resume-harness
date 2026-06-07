import { validateImportedResumePayload } from "./action-validation.mjs";

export function isUploadedResumeFile(value) {
  return value instanceof File && value.size > 0;
}

export async function importResumeFile({
  apiBaseUrl,
  fetchImpl = fetch,
  resumeFile,
  sessionToken,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "Resume import API is not configured." };
  }

  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate resume import." };
  }

  const importFormData = new FormData();
  importFormData.append("file", resumeFile, resumeFile.name);

  let importResponse;
  try {
    importResponse = await fetchImpl(`${apiBaseUrl}/api/resumes/import/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: importFormData,
    });
  } catch {
    return { ok: false, message: "Resume import API could not be reached." };
  }

  const importPayload = await importResponse.json().catch(() => null);
  if (!importResponse.ok) {
    const detail =
      typeof importPayload === "object" &&
      importPayload !== null &&
      "detail" in importPayload &&
      typeof importPayload.detail === "string"
        ? importPayload.detail
        : "Resume import failed.";
    return { ok: false, message: detail };
  }

  const imported = validateImportedResumePayload(importPayload);
  if (!imported.success) {
    return { ok: false, message: "Resume import returned invalid data." };
  }

  return { ok: true, imported: imported.data };
}

export function buildImportedResumeInsert({ imported, title, userProfileId }) {
  return {
    user_id: userProfileId,
    title,
    raw_text: imported.canonical_markdown,
    source_type: imported.source_type,
    source_file_name: imported.source_file_name,
    source_mime_type: imported.source_mime_type,
    source_size_bytes: imported.source_size_bytes,
    import_status: imported.import_status,
  };
}
