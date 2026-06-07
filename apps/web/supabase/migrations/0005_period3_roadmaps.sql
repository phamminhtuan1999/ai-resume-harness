create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  title text not null,
  roadmap_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roadmaps_user_id_created_at_idx
  on public.roadmaps (user_id, created_at desc);

create index if not exists roadmaps_match_id_created_at_idx
  on public.roadmaps (match_id, created_at desc);

alter table public.roadmaps enable row level security;

-- Server-side writes use the Supabase service role after Clerk verification.
-- Browser clients should not write roadmap rows directly in Period 3.
