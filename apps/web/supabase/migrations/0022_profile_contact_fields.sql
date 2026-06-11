-- User-editable contact fields for the career profile. The account email
-- (user_profiles.email) is re-synced from Clerk on every authenticated visit,
-- so the CV contact override needs its own column; phone had no column at all.
-- Generated drafts prefer these over the resume-imported basic_info values.
alter table public.user_profiles
  add column if not exists phone text,
  add column if not exists contact_email text;
