-- US-033 AI Cover Letter Generation (Period 8, Feature 5).
-- One cover letter per match (upserted on regenerate via on_conflict=match_id).
-- Generation runs on the server (apps/api) under the Supabase service role after
-- Clerk identity + ownership checks; browser clients must not write this table
-- directly. See docs/decisions/0012-ai-workflow-standards.md.

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null unique references public.matches(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  cover_letter text,
  cover_letter_strategy text,
  key_points_json jsonb not null default '[]'::jsonb,
  claims_avoided_json jsonb not null default '[]'::jsonb,
  tone text check (tone is null or tone in ('professional', 'concise', 'enthusiastic')),
  confidence_score numeric,
  provider text check (provider is null or provider in ('gemini', 'deterministic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cover_letters_user_id_idx
  on public.cover_letters (user_id);

alter table public.cover_letters enable row level security;
