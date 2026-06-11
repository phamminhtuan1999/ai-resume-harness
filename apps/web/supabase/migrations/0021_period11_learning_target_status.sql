-- US-052 Learning Target Tracker Flow (Period 11, Epic 9).
-- Adds 'learning_target' to the applications.status vocabulary: a weak-but-
-- directionally-relevant role the user is building skills toward. Additive only
-- (no data rewritten). Learning targets are NOT active applications — the web
-- layer excludes them from pipeline counts. Extends the canonical list in
-- docs/decisions/0009-application-tracker-status-values.md (refreshed by US-052).

alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check check (status in (
    'saved', 'prepared', 'applied', 'interviewing', 'offer', 'rejected', 'archived',
    'learning_target'
  ));
