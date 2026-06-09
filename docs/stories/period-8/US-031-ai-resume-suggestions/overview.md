# Overview

## Current Behavior

The resume suggestions page
(`apps/web/src/app/(app)/matches/[matchId]/resume-suggestions/page.tsx`) shows
suggestions built by `apps/web/src/lib/resume-suggestion-generator.mjs`
(`buildResumeSuggestions`): a deterministic, keyword-driven output with no AI
reasoning, no resume strategy narrative, no keywords-to-include or
claims-to-avoid list, and no per-row Accept/Reject/Edit actions. There is no run
history, no regeneration capability, and no Truth Guard classification beyond
what the existing static logic assigns. Output is tagged `model_provider:
"deterministic"`. (Shipped as US-008.)

## Target Behavior

ApplyWise generates a full set of tailored resume suggestions through the US-027
foundation using Gemini. The `ResumeSuggestionsWorkflow` loads the candidate
profile, resume text, job requirements, match analysis (US-028), and optional
missing-skill analysis (US-029); calls Gemini with the Feature-3 prompt; and
validates output into `ResumeSuggestionOutput`. Every suggestion carries a Truth
Guard status (`safe_to_use` / `needs_confirmation` / `do_not_use_yet`) mapped to
the title-case display values stored in `resume_suggestions.truth_guard_status`.
The AI also produces a `resume_strategy` narrative, a `keywords_to_include` list,
and a `do_not_claim` list.

Results are persisted to the existing `resume_suggestions` table (no schema
change), the full output snapshot stored in `ai_workflow_runs.output_snapshot_json`,
and an `activity_feed` event written. The existing page is upgraded in place to
render the strategy card, six grouped sections, per-row Accept/Reject/Edit
actions (PATCH), and a Regenerate button. The deterministic `buildResumeSuggestions`
becomes the typed fallback — not removed. `do_not_use_yet` suggestions are
excluded from resume drafts (US-032) by default.

## Affected Users

- Software engineers who have a match score and gap analysis and need concrete,
  evidence-backed wording changes — this is the first moment the product gives
  them something they can paste into their resume.

## Affected Product Docs

- `docs/product/ai-workflows.md` (Resume Suggestions section)
- `docs/product/data-model.md` (`resume_suggestions` Truth Guard mapping;
  `ai_workflow_runs` snapshot read path)
- `docs/decisions/0012-ai-workflow-standards.md` (inherited; no new decision)

## Non-Goals

- Resume draft generation (US-032 — consumes accepted suggestions from this story).
- Missing-skill deep analysis (US-029 — provides input to this story but is
  implemented separately).
- Changing the Truth Guard rules or stored display values from their current form.
- New routing — the existing `/matches/[matchId]/resume-suggestions` page is
  upgraded; no new route is needed.
