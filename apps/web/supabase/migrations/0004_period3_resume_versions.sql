create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  title text not null,
  content_markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resume_versions_user_id_created_at_idx
  on public.resume_versions (user_id, created_at desc);

create index if not exists resume_versions_match_id_created_at_idx
  on public.resume_versions (match_id, created_at desc);

alter table public.resume_versions enable row level security;

-- Server-side writes use the Supabase service role after Clerk verification.
-- Browser clients should not write resume draft rows directly in Period 3.
