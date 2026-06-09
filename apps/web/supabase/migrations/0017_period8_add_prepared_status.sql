-- US-038 AI Workflow Panel (Period 8, Feature 11).
-- Adds 'prepared' to the applications.status vocabulary: run-full orchestration
-- may mark an application prepared when all AI steps complete. Extends the
-- canonical list in docs/decisions/0009-application-tracker-status-values.md.

alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check check (status in (
    'saved', 'prepared', 'applied', 'interviewing', 'offer', 'rejected', 'archived'
  ));
