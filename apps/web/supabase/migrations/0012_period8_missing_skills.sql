-- US-029 AI Missing Skill Analysis (Period 8, Feature 2).
-- One missing-skill analysis per match (replaced on regenerate via upsert on
-- match_id). Generation runs on the server (apps/api) under the Supabase service
-- role after Clerk identity + ownership checks; browser clients must not write
-- this table directly. See docs/decisions/0012-ai-workflow-standards.md.

create table if not exists public.missing_skill_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null unique references public.matches(id) on delete cascade,
  summary text,
  missing_skills_json jsonb not null default '[]'::jsonb,
  top_3_priority_gaps_json jsonb not null default '[]'::jsonb,
  confidence_score numeric,
  provider text check (provider is null or provider in ('gemini', 'deterministic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists missing_skill_analyses_user_id_idx
  on public.missing_skill_analyses (user_id);

alter table public.missing_skill_analyses enable row level security;
