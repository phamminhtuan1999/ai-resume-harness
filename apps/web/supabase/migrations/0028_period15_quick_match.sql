-- US-068 AI quick match.
-- Quick match runs through the standard AI workflow path as a new workflow_type
-- on subject_type 'job' (already allowed). Postgres cannot add to a CHECK, so
-- the workflow_type constraint is dropped and recreated with 'quick_match'
-- appended; existing rows all use prior values and pass the widened constraint.

alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_workflow_type_check;
alter table public.ai_workflow_runs
  add constraint ai_workflow_runs_workflow_type_check check (workflow_type in (
    'match_analysis', 'missing_skills', 'resume_suggestions', 'resume_draft',
    'cover_letter', 'roadmap', 'interview_prep', 'assistant_insight',
    'dashboard_summary', 'activity_description', 'draft_cv', 'quick_match'
  ));
