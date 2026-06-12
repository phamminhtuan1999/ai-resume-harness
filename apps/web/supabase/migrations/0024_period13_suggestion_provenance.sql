-- Period 13 / US-061 (decision 0019): tier-1 feedback provenance.
-- A suggestion the user edited before accepting is "authoritative information"
-- for CV generation; the flag distinguishes ai_suggested from user_edited so
-- the generator and the final-check UI can treat them differently.
alter table public.resume_suggestions
  add column if not exists user_edited boolean not null default false;
