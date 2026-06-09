-- US-018 Add Job by URL with Fetcher.
-- Adds source/provenance, normalized URL for duplicate protection, and AI
-- extraction metadata to jobs. Firecrawl fetch + Gemini extraction run on the
-- server (apps/api) under the Supabase service role after Clerk identity and
-- ownership checks. Browser clients must not write these columns directly.

alter table public.jobs
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'manual_url')),
  add column if not exists source_url text,
  add column if not exists normalized_url text,
  add column if not exists employment_type text,
  add column if not exists salary_range text,
  add column if not exists extraction_status text not null default 'not_required'
    check (extraction_status in (
      'not_required', 'pending', 'succeeded', 'failed'
    )),
  add column if not exists extraction_confidence numeric,
  add column if not exists extraction_json jsonb;

-- work_type already exists from 0001_period1_foundation; left as-is.

-- One saved job per user per normalized URL. Partial so manually pasted jobs
-- (no normalized_url) are never treated as duplicates of each other.
create unique index if not exists jobs_user_id_normalized_url_unique
  on public.jobs (user_id, normalized_url)
  where normalized_url is not null;
