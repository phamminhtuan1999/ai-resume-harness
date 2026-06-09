-- US-030 Job Assistant Insight Card (Period 8, Feature 8).
-- One decision-oriented insight per match (replaced on regenerate via upsert on
-- match_id). The recommendation / risk_level / next_best_action are derived
-- server-side from the saved match analysis. Generation runs on the server
-- (apps/api) under the Supabase service role after Clerk identity + ownership
-- checks. See docs/decisions/0012-ai-workflow-standards.md.

create table if not exists public.assistant_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null unique references public.matches(id) on delete cascade,
  assistant_summary text,
  recommendation text check (recommendation is null or recommendation in (
    'apply_now', 'tailor_resume_first', 'build_project_first', 'low_priority'
  )),
  why_this_recommendation text,
  next_best_action text,
  application_strategy text,
  risk_level text check (risk_level is null or risk_level in ('low', 'medium', 'high')),
  confidence_score numeric,
  provider text check (provider is null or provider in ('gemini', 'deterministic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_insights_user_id_idx
  on public.assistant_insights (user_id);

alter table public.assistant_insights enable row level security;
