# Overview

## Current Behavior

ApplyWise generates match-scoped application materials as text: tailored
resume **suggestions** with Truth Guard rows (`resume_suggestions`, US-031)
and a tailored **Markdown draft** (`resume_versions`, US-032) displayed in a
`<pre>` block with no structure, no per-bullet evidence metadata, and no
export. There is no structured CV artifact, no `draft_cv` workflow type (the
`ai_workflow_runs.workflow_type` CHECK in migration `0010` does not include
it), and no `draft_cvs` table.

## Target Behavior

For a match with a saved match analysis, `POST /api/matches/{match_id}/draft-cv`
runs a `DraftCvWorkflow` on the US-027 foundation: one Gemini call whose
prompt embeds the Cross-Referencing & Enhancement Protocol
(`docs/stories/period-9/brief.md`), validated into a `DraftCvOutput` Pydantic
schema, then passed through three deterministic server guards (metrics,
keyword-support, XYZ/ATS lint). The result is persisted as an append-only
version row in the new `draft_cvs` table with server-assigned stable bullet
ids, per-bullet `truth_guard_status` (US-031 snake_case enum), per-bullet
`user_action = 'pending'`, and a server-derived status
(`needs_review | ready_to_export`). Regenerate inserts a new version and
preserves prior ones. A deterministic verbatim-copy fallback serves keyless
and provider-failure paths. Reads: `GET /api/matches/{match_id}/draft-cv`
(latest + version list) and `GET /api/draft-cvs/{draft_cv_id}`.

## Affected Users

- Software engineers who finished analysis and need the actual document to
  submit — this story creates the data and guarantees every later surface
  (review UI, PDF, DOCX) depends on.

## Affected Product Docs

- `docs/product/data-model.md` (`draft_cvs`, `workflow_type` extension)
- `docs/product/ai-workflows.md` (Draft CV Generator section)
- `docs/decisions/0013-draft-cv-export-architecture.md` (direction)
- `docs/decisions/0012-ai-workflow-standards.md` (inherited foundation)

## Non-Goals

- Any UI (US-040), PDF rendering (US-041), DOCX rendering (US-042).
- Approval endpoints (US-040 owns the PATCH surface).
- Editing generated text, export archival, template variants (out of scope
  for the period; see period README).
- Changing US-031/US-032 behavior or stored formats.
