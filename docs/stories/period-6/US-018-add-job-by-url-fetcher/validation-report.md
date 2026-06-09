# US-018 Validation Report — Add Job by URL with Fetcher

Date: 2026-06-08
Story: US-018 (Period 6, high-risk)
Decision: `docs/decisions/0010-job-url-fetch-provider-strategy.md`

## Status

Implementation complete and **live-verified** against the real providers and
database. Migration 0009 applied to live Supabase; Firecrawl fetch, Gemini
extraction, the job insert, and the duplicate-protection index were all
exercised end to end on a real posting (see "Live verification"). The only path
not headlessly automated is the browser click-through (React form -> server
action), which is gated by Clerk's hosted sign-in and needs a manual check.

## What shipped

End-to-end job-URL intake following decision 0010 (Firecrawl-first):

- **Data model** — `apps/web/supabase/migrations/0009_period6_job_url_intake.sql`
  adds `source`, `source_url`, `normalized_url`, `employment_type`,
  `salary_range`, `extraction_status`, `extraction_confidence`,
  `extraction_json` to `public.jobs`, plus a partial unique index on
  `(user_id, normalized_url)` for duplicate protection. (Written; not yet
  applied to the live database.)
- **Backend (apps/api)** — `POST /api/jobs/import-url` under
  `require_authenticated_user`:
  - URL validate + normalize + tracking-param strip (`url_normalize.py`).
  - Duplicate check on `(user_id, normalized_url)`; returns the existing job
    instead of inserting.
  - Firecrawl scrape client (`firecrawl_client.py`), gated on
    `FIRECRAWL_API_KEY`; untrusted output, content never logged.
  - Gemini extractor (`job_extractor.py`) with a strict `response_schema` and
    transient-error retry, mirroring the candidate-profile extractor.
  - Free-text `work_type`/`employment_type` normalized to the allowed sets;
    host-derived company fallback so a saved job always has company + title.
  - Service-role insert via `SupabaseDataClient.insert_job`.
  - Any fetch/extract failure (including no provider key) maps to the
    manual-paste fallback message.
- **Web (apps/web)** — two-mode `/jobs/new` (`job-intake.tsx`):
  - `job-url-form.tsx` posts to `importJobByUrlAction`; on failure it shows the
    fallback and a "Paste the description manually" button that preserves the
    URL into the manual form.
  - Best-effort auto-scoring (`scoreImportedJob`) creates a match against the
    most recent resume; degrades to save-without-score when none exists.
  - Jobs list shows a Match score badge (from existing match data; no query
    change).

## Mechanical checks (green)

- `apps/api` pytest — 52 passed (25 new for jobs: endpoint auth, validation,
  dedupe, success, host-fallback, every fetch/extract failure path; URL
  normalizer; Firecrawl client; extractor retry).
- `npm run test:web` — 65 passed (7 new for the job-import flow).
- `npm run lint:web` — clean. `apps/api` ruff — clean.
- `npm --workspace apps/web exec tsc --noEmit` — clean.
- `npm run build:web` — compiles; all 23 routes build, including `/jobs/new`.
- `git diff --check` — clean.

## Live verification (2026-06-08)

Run against the real services with all keys configured in `apps/api/.env.local`:

- **Firecrawl fetch (live)** — scraped a real, currently-open Anthropic posting
  (resolved via the Greenhouse boards API): 19,517 chars of markdown returned.
- **Gemini extraction (live)** — structured the page at **0.95 confidence**:
  company "Anthropic", title "Account Executive, AI Native", location, and
  free-text `work_type`/`employment_type` normalized to `hybrid` / `full-time`;
  salary, required/preferred skills, and "2-3 years" experience all populated.
- **Supabase insert (live)** — a job row with the new columns
  (`source=manual_url`, `extraction_status=succeeded`, ...) inserted and read
  back successfully against the migrated schema.
- **Duplicate protection (live)** — a second insert with the same
  `(user_id, normalized_url)` was rejected by
  `jobs_user_id_normalized_url_unique`. The smoke row was deleted afterward
  (0 residual rows).

## Deferred (manual check)

- **Browser click-through** — the `/jobs/new` URL form -> `importJobByUrlAction`
  -> API hop through a real Clerk-authenticated session was not automated
  headlessly (Clerk's hosted sign-in). Recommended manual check: sign in, paste
  a job URL, confirm the fetched + scored job appears in `/jobs`, and confirm a
  blocked URL shows the manual-paste fallback.
