-- US-039 Draft CV Generation & Data Model (Period 9, AI Draft CV Export).
-- Append-only, truth-guarded, exportable draft CV versions per match. Generation
-- runs on the server (apps/api) under the Supabase service role after Clerk
-- identity + ownership checks; browser clients must not write this table
-- directly. See docs/decisions/0013-draft-cv-export-architecture.md and
-- docs/stories/period-9/US-039-draft-cv-generation/.

-- Extend the shared workflow_type enum with 'draft_cv'. The constraint was
-- defined inline in 0010 (default name ai_workflow_runs_workflow_type_check);
-- Postgres cannot add to a CHECK, so drop + recreate it in place. Existing rows
-- all use prior values and pass the widened constraint.
alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_workflow_type_check;
alter table public.ai_workflow_runs
  add constraint ai_workflow_runs_workflow_type_check check (workflow_type in (
    'match_analysis', 'missing_skills', 'resume_suggestions', 'resume_draft',
    'cover_letter', 'roadmap', 'interview_prep', 'assistant_insight',
    'dashboard_summary', 'activity_description', 'draft_cv'
  ));

create table if not exists public.draft_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  -- Denormalized pointers so a draft stays queryable "under the job record"
  -- even though the match cascade governs its lifecycle.
  job_id uuid references public.jobs(id) on delete set null,
  resume_id uuid references public.resumes(id) on delete set null,
  version integer not null,
  title text not null,
  -- Derived server-side; never user-set. No 'failed' value: failed generations
  -- write only an ai_workflow_runs row, no draft row.
  status text not null default 'draft' check (status in (
    'draft', 'needs_review', 'ready_to_export', 'exported'
  )),
  -- The full structured CV. Each experience/project bullet carries a
  -- server-assigned stable id, truth_guard_status (snake_case), and user_action.
  cv_json jsonb not null,
  cv_strategy_json jsonb,
  quality_notes_json jsonb,
  confidence_score numeric,
  provider text check (provider is null or provider in ('gemini', 'deterministic')),
  model_name text,
  -- Exports render on demand and stream; no binary is stored. These stamp the
  -- last successful render of each format (US-041/US-042).
  last_exported_pdf_at timestamptz,
  last_exported_docx_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, version)
);

create index if not exists draft_cvs_user_job_idx
  on public.draft_cvs (user_id, job_id, created_at desc);

create index if not exists draft_cvs_match_idx
  on public.draft_cvs (match_id, version desc);

alter table public.draft_cvs enable row level security;
