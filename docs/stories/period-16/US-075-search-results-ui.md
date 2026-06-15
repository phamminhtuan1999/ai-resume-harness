# US-075 Search AI Jobs Results UI + Empty / Provider-Failure States

## Status

planned

## Lane

normal

## Product Contract

The Search AI Jobs tab lets a user enter a target role, location, remote
preference, and experience level, then see AI-focused results they can act on.
Each result clearly separates **AI relevance** from **candidate quick match**,
shows a short assistant summary and a recommended action, and offers Save, Save
& Analyze, and Open Apply Link. Non-AI and hidden jobs are not silently
discarded — they are summarized with a "show hidden jobs" affordance and their
exclude reason. Empty results and provider failures give the user concrete next
steps, including falling back to URL import or Paste JD.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 2.2, 10, Section 8, 17)
- `PRODUCT.md` (honest coach; verdict-first), `DESIGN.md` (cards/badges/lists)
- `docs/stories/period-16/US-074-search-ai-enrichment.md` (response shape)

## Acceptance Criteria

- The Search tab form exposes MVP fields (target role/keyword, location, remote
  only, experience level) with the Section 8 placeholder and default filters
  (only AI-related, hide research-heavy, hide non-engineering AI, prioritize
  transition-friendly), and submits to `POST /api/jobs/search-ai`.
- Each result card shows: role title, company, location, source, AI relevance
  label, transition friendliness, quick match score (when available), short
  assistant summary, recommended action, and actions Save / Save & Analyze /
  Open Apply Link (Section 8 card fields).
- AI relevance and quick match are visually distinct (Principle 2 / honest-coach
  register): the relevance label is about the job; the quick match is about the
  user's fit — neither is dressed up as the analyzed verdict.
- Strongly AI-related jobs are marked as strong; possibly-AI as possible /
  AI-adjacent; below-threshold jobs are hidden by default but revealable via
  "show hidden jobs" with their exclude reason (Epic 5.2 / 10).
- Empty state (no AI-related jobs) shows the Section 17 guidance (broaden role,
  switch to Remote US, show AI-adjacent). Provider failure shows a retry plus
  "Import Job URL" and "Paste Job Description" fallbacks (Epic 10.1).
- "Match preview unavailable" renders when quick match is missing, without
  hiding the job.
- List/table presentation follows the project preference for list tables over
  card grids on index/history-style surfaces where applicable.

## Design Notes

- Commands: none.
- Queries: none server-side new (calls US-073/074 endpoint).
- API: consumes `POST /api/jobs/search-ai`.
- Tables: none (results transient until Save in US-077).
- Domain rules: default-hide research-heavy / non-engineering AI; never fabricate
  a relevance or match score.
- UI surfaces: Search tab content in `job-intake.tsx`; new search form +
  results components under `apps/web/src/components/jobs/`; a server action or
  client fetch wrapper in `apps/web/src/lib/actions.ts`. Reuse existing badge /
  empty-state / alert primitives.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-075 --unit 1 --integration 0 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Card view-model mapping (relevance vs quick match separation, recommended-action label, hidden-job grouping, preview-unavailable). |
| Integration | Search action wires request/response shape and error envelopes. |
| E2E | Submitting a search renders enriched cards; strong vs possible marking; empty state guidance; provider-failure fallback to URL/Paste; "show hidden jobs" reveals excluded results. |
| Platform | n/a |
| Release | Results render even when AI enrichment is partial or unavailable. |

## Harness Delta

Intake #51. Pure UI over US-073/074 contracts; no new decision. Capture any
copy that should live in `docs/product/ui-ux-quality.md`.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
