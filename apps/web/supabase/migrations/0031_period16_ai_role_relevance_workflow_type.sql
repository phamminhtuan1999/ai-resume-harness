-- US-072 AI Role Relevance classifier.
-- Adds 'ai_role_relevance' to the workflow_type check constraint.
-- PostgreSQL cannot extend a CHECK in-place; drop and recreate with the new
-- value appended. All existing rows use prior values and pass the widened set.

alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_workflow_type_check;

alter table public.ai_workflow_runs
  add constraint ai_workflow_runs_workflow_type_check check (workflow_type in (
    'match_analysis', 'missing_skills', 'resume_suggestions', 'resume_draft',
    'cover_letter', 'roadmap', 'interview_prep', 'assistant_insight',
    'dashboard_summary', 'activity_description', 'draft_cv', 'quick_match',
    'ai_role_relevance'
  ));
