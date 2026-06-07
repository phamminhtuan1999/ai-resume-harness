create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  applied_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists applications_user_id_created_at_idx
  on public.applications (user_id, created_at desc);

create index if not exists applications_user_id_status_created_at_idx
  on public.applications (user_id, status, created_at desc);

create index if not exists applications_job_id_idx
  on public.applications (job_id);

create index if not exists applications_match_id_idx
  on public.applications (match_id);

alter table public.applications enable row level security;

-- Server actions use the Supabase service role after Clerk identity and
-- ownership checks. Browser clients should not write tracker rows directly.
