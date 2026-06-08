# Design

## Domain Model

No domain entities change. The story affects validation and presentation for
profiles, resumes, jobs, matches, applications, and generated match artifacts.

## Application Flow

Server actions keep the same inputs and destinations. The action result now
supports an optional `fieldErrors` map so forms can display field-specific
messages while preserving form-level alerts for auth, configuration, API, and
persistence failures.

## Interface Contract

Forms expose:

- Required markers for required visible fields.
- Helper text under each field or workflow control.
- Field-level errors under affected fields.
- Form-level alerts for cross-field or persistence errors.
- Pending submit labels from `SubmitButton`.
- Popup success feedback.
- Redirects for create flows that should return to list or generated views.

## Data Model

No table, index, migration, or retention changes.

## UI / Platform Impact

The UI stays restrained and operational. Helper text is compact, required
markers use the existing destructive color token, and field errors use the same
compact text rhythm to avoid layout jump and visual noise.

## Resume Import Contract

Supported file inputs:

- PDF.
- DOCX.
- PNG, JPG, JPEG, and WEBP images.
- Markdown and plain text.

The web layer validates file extension or MIME type plus a 10 MB maximum before
calling the import API when browser `File` metadata is available.

## Observability

No new runtime logging is required. Browser verification must check framework
overlays, console errors, horizontal overflow, and accepted resume file types.

## Alternatives Considered

1. Keep errors form-level only. Rejected because the story explicitly requires
   field-level feedback.
2. Put file validation only in the API. Rejected because the browser can catch
   unsupported type and size before a network call.
3. Add a full form library. Rejected because server actions and small forms are
   already simple enough for the current helper pattern.
