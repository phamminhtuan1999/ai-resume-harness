# Period 17 - Tailored CV Preview And Version Diff

## Goal

Make the Tailored CV review surface (`/matches/{matchId}/draft-cv`) easier to
trust: let the user (1) see the **real rendered PDF** inside the app before
exporting, and (2) see **what changed between CV versions** in a Git-style diff.

Source input: user request (2026-06-14) — "show the resume PDF in the app after
analyze (currently only the generated information is shown), and show a diff
when the resume updates, with a Git-diff-style UI" (reference screenshot:
Words/Lines toggle, FROM/TO version pickers, added/removed char stats).

Intake: new initiative, normal lane — adds one read-only backend endpoint plus
web UI; additive, no schema change, no behavior regression.

Direction recorded in `docs/decisions/0024-cv-preview-and-version-diff.md`.

## Verification Against the Codebase

Confirmed before slicing:

| Fact | Status | Evidence |
| --- | --- | --- |
| Draft CVs are append-only + versioned | Yes | `draft_cvs.version`, `unique(match_id, version)` (US-039) |
| Every version's `cv_json` is already on the page | Yes | `getDraftCvDetail` selects `cv_json` for all `versions` |
| Export route stamps `status = exported` + activity | Yes | `_stamp_export` in `draft_cvs.py` (US-041) |
| A word-level diff already exists (bullet scope) | Yes | `word-diff.mjs` (US-061) |

Conclusion: the diff needs **no backend** (versions already client-side); the
PDF preview needs **one read-only endpoint** that reuses the export render
pipeline without the export stamp. The preview must render the same PDF
configuration the user would export at that moment: current draft version,
selected page count, selected font profile, and the same server render
pipeline.

## Stories

| Story | Title | Shape |
| --- | --- | --- |
| US-078 | Tailored CV in-app PDF preview (non-stamping render endpoint) | Normal flat story |
| US-079 | Tailored CV version diff (Words/Lines, any two versions) | Normal flat story (web-only) |

## Scope Summary

In scope: read-only `GET /api/draft-cvs/{id}/preview/pdf`; "Preview PDF" button +
inline `<iframe>` viewer; preview/export option parity for selected `pages` and
`font`; client-side `version-diff.mjs` (Words/Lines + char stats);
`draftCvToText` serializer; the Version Diff panel (FROM/TO any two CV
versions). Out of scope: a standalone resume analyzer page, score cards, visual
PDF pixel diff, diffing against the original imported resume.
