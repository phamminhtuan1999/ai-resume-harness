# Overview

## Current Behavior

No cover letter generation exists anywhere in the codebase. After match analysis
runs, the user must draft a cover letter manually from scratch, risking generic
language and unsupported claims. The closest prior output is the AI match
analysis (US-028), which produces fit reasoning and evidence-linked strengths but
no prose letter.

## Target Behavior

ApplyWise generates a personalized cover letter through a new
`CoverLetterWorkflow` built on the US-027 `BaseAIWorkflow` foundation. The
workflow accepts the candidate profile, job requirements, match analysis, optional
resume strategy (US-031 if present), company name, and role title — and returns
a cover letter, the strategy behind it, key points used, claims deliberately
avoided, a tone classification, and a confidence score.

Results persist to a new `cover_letters` table (one active letter per match;
regenerate overwrites). Each generation writes an `ai_workflow_runs` row and an
`activity_feed` event. A new page at
`apps/web/src/app/(app)/matches/[matchId]/cover-letter/page.tsx` lets the user
read, copy, save, and regenerate the letter. The fallback is a
`TemplatedFallbackProvider` that assembles a safe letter from US-028 match
analysis + candidate profile + job company/title — guaranteed to make no
unsupported claims, `provider = deterministic`.

## Affected Users

- Software engineers who have scored a match and are ready to apply — this story
  produces the first AI-generated writing artifact.

## Affected Product Docs

- `docs/product/ai-workflows.md` (Cover Letter section)
- `docs/product/data-model.md` (`cover_letters` table)
- `docs/decisions/0012-ai-workflow-standards.md` (provider boundary inherited)

## Non-Goals

- Editing the cover letter body in-app beyond the textarea auto-save (rich
  editor is a future scope item).
- Job-centric routing — the flow doc resolves the brief's `/jobs/:id/cover-letter`
  to `/matches/[matchId]/cover-letter` per `docs/stories/period-8/flows/README.md`.
- Resume suggestions or roadmap features (US-031+).
- Cover letter versioning/history beyond what `ai_workflow_runs` provides.
