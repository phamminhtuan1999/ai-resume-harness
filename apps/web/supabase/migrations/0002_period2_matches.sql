alter table public.resumes
  add column if not exists structured_json jsonb,
  add column if not exists parse_status text not null default 'not_parsed';

alter table public.jobs
  add column if not exists structured_json jsonb,
  add column if not exists parse_status text not null default 'not_parsed';

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  overall_score integer not null check (overall_score between 0 and 100),
  skill_score integer not null check (skill_score between 0 and 100),
  experience_score integer not null check (experience_score between 0 and 100),
  ai_readiness_score integer not null check (ai_readiness_score between 0 and 100),
  ats_keyword_score integer not null check (ats_keyword_score between 0 and 100),
  seniority_score integer not null check (seniority_score between 0 and 100),
  strengths_json jsonb not null default '[]'::jsonb,
  weaknesses_json jsonb not null default '[]'::jsonb,
  missing_skills_json jsonb not null default '[]'::jsonb,
  risks_json jsonb not null default '[]'::jsonb,
  explanation_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_user_id_created_at_idx
  on public.matches (user_id, created_at desc);

create index if not exists matches_resume_id_idx
  on public.matches (resume_id);

create index if not exists matches_job_id_idx
  on public.matches (job_id);

alter table public.matches enable row level security;

-- Server-side writes use the Supabase service role after Clerk verification.
-- Browser clients should not write match analysis rows directly in Period 2.
