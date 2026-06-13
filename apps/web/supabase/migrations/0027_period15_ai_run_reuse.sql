-- US-067 version-keyed AI run reuse.
-- A run can be served from a prior persisted result when the inputs, the prompt
-- version, and the resolved model all match. These columns record the identity
-- of each run so the reuse decision is durable and auditable. Both are nullable:
-- historical rows (and workflows that do not opt into reuse) leave them null,
-- and a null input_hash is never treated as a reusable match.

alter table public.ai_workflow_runs
  add column if not exists input_hash text,
  add column if not exists prompt_version text;

-- The reuse lookup reads the latest matching run per (user, workflow_type,
-- subject); this index keeps that lookup cheap as the run history grows.
create index if not exists idx_ai_workflow_runs_reuse
  on public.ai_workflow_runs (user_id, subject_type, subject_id, workflow_type, created_at desc);
