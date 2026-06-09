-- US-036 Dashboard AI Summary (Period 8, Feature 9).
-- One current cross-job summary per user, overwritten on regenerate
-- (ON CONFLICT (user_id) DO UPDATE). Written only by the server (apps/api)
-- under the Supabase service role after Clerk identity checks; browser clients
-- must not write this table directly. workflow_type 'dashboard_summary' and
-- subject_type 'dashboard' are already present in the 0010 check constraints.

create table if not exists public.dashboard_ai_summary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  dashboard_summary text not null default '',
  best_fit_roles_json jsonb not null default '[]'::jsonb,
  repeated_skill_gaps_json jsonb not null default '[]'::jsonb,
  job_search_health text not null check (job_search_health in (
    'strong', 'moderate', 'weak', 'not_enough_data'
  )),
  recommended_next_actions_json jsonb not null default '[]'::jsonb,
  confidence_score numeric(4,3),
  provider text check (provider in ('gemini', 'deterministic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_ai_summary enable row level security;
