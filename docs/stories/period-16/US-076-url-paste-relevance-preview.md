# US-076 URL + Paste JD: AI Relevance Preview, Extraction, Non-AI Warning

## Status

planned

## Lane

normal (changes existing intake behavior)

## Product Contract

Importing a job by URL or pasting a job description no longer goes straight to a
saved row. Both paths first show a **preview** of the extracted job plus its **AI
Role Relevance** (and a Candidate Quick Match preview when a profile exists), and
ask the user to confirm before saving or analyzing. When a job is not strongly
AI-related, ApplyWise warns the user and offers "Add Anyway" or "Find AI-related
jobs instead" rather than silently saving or refusing. Pasted descriptions are
run through AI extraction so structured fields are populated, with a confirm/edit
step when key fields are uncertain.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 3, 4, Section 9, 10)
- `apps/api/app/services/ai/job_extractor.py` (`extract_job_from_markdown`)
- `docs/stories/period-16/US-072-ai-role-relevance-classifier.md`

## Acceptance Criteria

- **URL import**: after extraction (existing `import-url` flow), the user sees a
  preview with title, company, location, source URL, AI relevance label,
  transition friendliness, research-heavy and engineering-focused indicators,
  and may choose Save Only, Save & Analyze, or Cancel (Epic 3.1). Full analysis
  is not auto-run on import (Section 9 UX rule).
- **Paste JD**: the pasted description is sent to AI extraction
  (`extract-from-description`, reusing the `job_extraction` task) to populate
  title, company, location, employment type, responsibilities, required +
  preferred skills, AI/LLM requirements, seniority signals, and the original
  text. When title/company cannot be extracted confidently, the UI asks the user
  to confirm or edit before saving (Epic 4.1). Too-short descriptions show a
  validation message.
- Both paths run the AI Role Relevance Check (US-072) on the extracted job and
  display its result before save (Epic 4.2).
- **Non-AI warning**: when relevance says not-AI-related, the UI shows the
  Section 17 warning and offers "Add Anyway" and "Find AI-related jobs instead"
  (switches to the Search tab). The user is never blocked from adding, and the
  job is never silently dropped (Epic 3.2 / 4.2).
- On extraction failure for URL import, the user is offered the Paste JD path
  (existing fallback, preserved).
- Existing successful URL/paste saves still work; the change is the inserted
  preview + relevance gate, not a rewrite of save mechanics (save itself is
  US-077).

## Design Notes

- Commands: none (no migration; uses US-071 columns at save time).
- Queries: reads candidate profile for the optional quick match preview.
- API: new `POST /api/jobs/extract-from-description` (paste → structured job)
  in `apps/api/app/routers/jobs.py`, reusing `extract_job_from_markdown`;
  relevance via US-072. URL import endpoint extended to return the relevance
  preview alongside extraction.
- Tables: none new.
- Domain rules: do not invent missing fields (Section 9 business rule); do not
  auto-analyze on import; AI relevance shown before commit.
- UI surfaces: `job-url-form.tsx` gains a preview/confirm step;
  `job-form.tsx` (Paste tab) gains AI extraction + confirm/edit + relevance
  preview; shared relevance preview component reused by US-075.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-076 --unit 1 --integration 1 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Preview view-model; confirm/edit gating when fields uncertain; too-short JD validation; warning-state logic (Add Anyway / Find AI jobs). |
| Integration | `extract-from-description` returns structured fields; URL import returns extraction + relevance; relevance failure degrades to extraction-only preview. |
| E2E | URL import shows preview + relevance then Save Only / Save & Analyze / Cancel; paste JD extracts then previews; non-AI job shows warning with both options; extraction failure offers paste fallback. |
| Platform | n/a |
| Release | Existing URL/paste happy paths still save without regression. |

## Harness Delta

Intake #51. Changes existing intake behavior (preview before save) — note in
`docs/product/` intake UX surface. No new decision beyond 0024/0025/0026 unless
the paste-extraction contract changes shape.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
