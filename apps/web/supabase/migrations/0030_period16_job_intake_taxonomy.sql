-- US-071 Period 16: job intake source taxonomy + AI relevance / quick-match columns.
-- Additive and idempotent (re-runnable). All new columns are nullable so
-- existing rows need no backfill beyond the source rename.
-- Decision refs: 0026 (persistence shape), 0027 (source taxonomy).

-- 1. Backfill: 'manual' (pasted JD) → 'manual_paste'. No-op on reruns.
update public.jobs
  set source = 'manual_paste'
  where source = 'manual';

-- 2. Reconcile the source check constraint to the three-value canonical set
--    (decision 0027). The inline constraint added in 0009 was auto-named
--    jobs_source_check by PostgreSQL. Drop and replace with an explicit name.
alter table public.jobs
  drop constraint if exists jobs_source_check;

alter table public.jobs
  alter column source set default 'manual_paste';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_source_p16_check'
  ) then
    alter table public.jobs
      add constraint jobs_source_p16_check
        check (source in ('discovered_api', 'manual_url', 'manual_paste'));
  end if;
end;
$$;

-- 3. External provider identity (discovered_api jobs; null for manual_* rows).
alter table public.jobs
  add column if not exists external_source      text,
  add column if not exists external_job_id      text,
  add column if not exists external_apply_url   text,
  add column if not exists external_posted_at   timestamptz,
  add column if not exists external_raw_payload jsonb;

-- 4. AI Role Relevance columns (US-072 produces; US-076/077 write to jobs row).
--    engineering_focused defaults true — the expectation for the Applied AI
--    Engineer path; research_heavy defaults false for the same reason.
alter table public.jobs
  add column if not exists ai_relevance_score    integer,
  add column if not exists ai_role_category      text,
  add column if not exists ai_relevance_label    text,
  add column if not exists transition_friendliness text,
  add column if not exists research_heavy        boolean not null default false,
  add column if not exists engineering_focused   boolean not null default true,
  add column if not exists ai_relevance_json     jsonb;

-- 5. Candidate Quick Match preview columns (US-076/077 produce and write these).
alter table public.jobs
  add column if not exists quick_match_score   integer,
  add column if not exists quick_match_label   text,
  add column if not exists quick_match_summary text,
  add column if not exists quick_match_json    jsonb;
