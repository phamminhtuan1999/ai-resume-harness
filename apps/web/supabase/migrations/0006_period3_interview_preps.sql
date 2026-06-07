create table if not exists public.interview_preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  questions_json jsonb not null,
  weak_topics_json jsonb not null,
  study_plan_json jsonb not null,
  answer_guidance_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_preps_user_id_created_at_idx
  on public.interview_preps (user_id, created_at desc);

create index if not exists interview_preps_match_id_created_at_idx
  on public.interview_preps (match_id, created_at desc);

alter table public.interview_preps enable row level security;

-- Server actions use the service role after explicit ownership checks.
-- Browser clients should not write interview prep rows directly in Period 3.
