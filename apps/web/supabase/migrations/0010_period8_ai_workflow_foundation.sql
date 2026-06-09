-- US-027 AI Workflow Foundation & Standards (Period 8, Feature 12).
-- Shared substrate for every Period 8 AI feature (US-028..US-038): one durable
-- record per AI run and one user-facing activity event per run. All AI
-- generation runs on the server (apps/api) under the Supabase service role after
-- Clerk identity + ownership checks; browser clients must not write these tables
-- directly. See docs/decisions/0012-ai-workflow-standards.md.

-- One execution of one AI workflow for one subject (match | resume | job |
-- dashboard). The audit/observability record for every AI feature.
create table if not exists public.ai_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  workflow_type text not null check (workflow_type in (
    'match_analysis', 'missing_skills', 'resume_suggestions', 'resume_draft',
    'cover_letter', 'roadmap', 'interview_prep', 'assistant_insight',
    'dashboard_summary', 'activity_description'
  )),
  subject_type text not null check (subject_type in (
    'match', 'resume', 'job', 'dashboard'
  )),
  subject_id uuid,
  status text not null default 'queued' check (status in (
    'queued', 'running', 'completed', 'needs_review', 'failed'
  )),
  model_provider text check (model_provider in ('gemini', 'deterministic')),
  model_name text,
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  confidence_score numeric,
  output_snapshot_json jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_workflow_runs_subject_idx
  on public.ai_workflow_runs (user_id, subject_type, subject_id, workflow_type);

create index if not exists ai_workflow_runs_user_id_created_at_idx
  on public.ai_workflow_runs (user_id, created_at desc);

-- A user-facing record that an AI step happened. assistant_description is the
-- short AI text (filled by US-037; a deterministic fallback is allowed).
create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  workflow_run_id uuid references public.ai_workflow_runs(id) on delete set null,
  activity_type text not null,
  related_job_id uuid references public.jobs(id) on delete set null,
  related_match_id uuid references public.matches(id) on delete set null,
  title text not null,
  assistant_description text,
  importance text not null default 'low' check (importance in (
    'low', 'medium', 'high'
  )),
  created_at timestamptz not null default now()
);

create index if not exists activity_feed_user_id_created_at_idx
  on public.activity_feed (user_id, created_at desc);

alter table public.ai_workflow_runs enable row level security;
alter table public.activity_feed enable row level security;
