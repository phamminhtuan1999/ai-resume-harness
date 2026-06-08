alter table public.user_profiles
  add column if not exists candidate_profile_json jsonb,
  add column if not exists candidate_profile_confidence_json jsonb,
  add column if not exists profile_source text not null default 'manual'
    check (profile_source in ('manual', 'resume_import')),
  add column if not exists profile_source_resume_id uuid references public.resumes(id) on delete set null;

create index if not exists user_profiles_profile_source_resume_id_idx
  on public.user_profiles (profile_source_resume_id);

-- Server-side writes use the Supabase service role after Clerk identity and
-- ownership checks. Browser clients should not write imported profile JSON
-- directly.
