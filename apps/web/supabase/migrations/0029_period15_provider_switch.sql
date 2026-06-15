-- US-069 provider switch readiness.
-- model_provider was a closed enum check ('gemini','deterministic'). Provider
-- names are now open-ended (adapters register by name), so drop the value check
-- to accommodate future providers without breaking existing rows. The column
-- stays text/nullable; all existing values remain valid. Idempotent.

alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_model_provider_check;
