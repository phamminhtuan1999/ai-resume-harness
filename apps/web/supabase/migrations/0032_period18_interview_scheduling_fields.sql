-- US-082: optional interview scheduling metadata on a tracker row.
--
-- Additive and nullable, so existing applications stay valid. These fields live
-- on the application row and are independent of matches / interview_preps (a row
-- may have no match). interview_date is intentionally distinct from applied_date
-- (applying vs. interviewing are different lifecycle events). Tracker status
-- semantics are unchanged: a Learning Target may carry interview fields and is
-- still a Learning Target until the user changes the status.
--
-- interview_stage is free text here (like notes); the known-stage vocabulary is
-- enforced in the app layer (interview-schedule.mjs) so it can evolve without a
-- migration.

alter table public.applications
  add column if not exists interview_date date,
  add column if not exists interview_stage text,
  add column if not exists interview_notes text;

-- Partial index for the US-083 calendar view: "upcoming interviews for this
-- user, by date". Only rows that actually carry a date are indexed.
create index if not exists applications_user_interview_date_idx
  on public.applications (user_id, interview_date)
  where interview_date is not null;
