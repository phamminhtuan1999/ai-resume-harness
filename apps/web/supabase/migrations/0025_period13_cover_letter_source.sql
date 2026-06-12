-- Period 13 / US-063 (decision 0019): the cover letter is generated from the
-- final Tailored CV, so the letter records which draft version it was built
-- from. Powers the "generated from CV version N" linkage and the staleness
-- hint when a newer CV version exists.
alter table public.cover_letters
  add column if not exists source_draft_cv_id uuid references public.draft_cvs(id) on delete set null,
  add column if not exists source_draft_cv_version integer;
