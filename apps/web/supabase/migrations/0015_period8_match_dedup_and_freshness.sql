-- Match dedup + freshness (Period 8 hardening).
--
-- (1) Freshness: `analyzed_at` records when the AI match analysis was generated,
--     so the app can detect staleness by comparing it to resume/job `updated_at`
--     (Option A — timestamp based). Set by save_match_analysis going forward.
-- (2) Dedup: one analysis per (user, resume, job). Existing duplicate rows are
--     collapsed (keep the most recently updated), then a unique index enforces it
--     for every future insert (web, backend, races). The web also pre-checks +
--     handles the unique-violation gracefully (redirect to the existing report).

alter table public.matches
  add column if not exists analyzed_at timestamptz;

-- Backfill: existing analyzed matches treat their updated_at as analyzed_at.
update public.matches
  set analyzed_at = updated_at
  where analyzed_at is null and apply_recommendation is not null;

-- Collapse duplicates: delete every (user, resume, job) row that is older than
-- the newest in its group (ties broken by id). Cascades to that duplicate's AI
-- artifacts, which were themselves duplicates.
delete from public.matches m
  using public.matches keep
  where m.user_id = keep.user_id
    and m.resume_id = keep.resume_id
    and m.job_id = keep.job_id
    and (coalesce(m.updated_at, m.created_at), m.id)
        < (coalesce(keep.updated_at, keep.created_at), keep.id);

create unique index if not exists matches_user_resume_job_uniq
  on public.matches (user_id, resume_id, job_id);
