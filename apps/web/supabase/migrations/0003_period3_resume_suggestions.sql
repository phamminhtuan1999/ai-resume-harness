create table if not exists public.resume_suggestions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  original_text text,
  suggested_text text not null,
  suggestion_type text,
  related_job_requirement text,
  evidence text,
  truth_guard_status text not null
    check (truth_guard_status in ('Safe to use', 'Needs confirmation', 'Do not use yet')),
  reason text,
  user_action text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resume_suggestions_match_id_created_at_idx
  on public.resume_suggestions (match_id, created_at);

alter table public.resume_suggestions enable row level security;

-- Server-side writes use the Supabase service role after Clerk verification.
-- Browser clients should not write suggestion rows directly in Period 3.
