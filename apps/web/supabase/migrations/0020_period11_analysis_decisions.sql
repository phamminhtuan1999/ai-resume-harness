-- US-047 Job Analysis Decision Engine & Unified Analysis Package (Period 11).
-- Append-only decision snapshots: one row per recompute, never updated or
-- deleted. Written ONLY by recompute_decision on the server (apps/api) under the
-- Supabase service role after Clerk identity + ownership checks; the GET
-- /analysis-package read path never writes. See
-- docs/decisions/0015-job-analysis-decision-engine.md §7 and
-- docs/stories/period-11/US-047-analysis-package-decision-engine/.

create table if not exists public.analysis_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  -- The server-computed verdict. Model text never sets this (0015 §1).
  label text not null check (label in (
    'strong_apply', 'apply_with_improvements', 'learning_target', 'not_recommended'
  )),
  display_label text not null,
  match_score numeric,
  -- The sub-score breakdown at decision time, so history can show how
  -- skill/ai_readiness/etc. moved between runs (0015 §7).
  scores_json jsonb not null default '{}'::jsonb,
  risk_level text check (risk_level is null or risk_level in ('low', 'medium', 'high')),
  confidence numeric,
  confidence_reasons_json jsonb not null default '[]'::jsonb,
  summary text,
  evidence_json jsonb not null default '{}'::jsonb,
  -- Module row ids + timestamps used for this decision (human-readable history).
  inputs_snapshot_json jsonb not null default '{}'::jsonb,
  -- Hash of module row ids + their updated_at + rules_version: the
  -- compare-before-insert identity that dedupes snapshots (0015 §7).
  inputs_hash text not null,
  -- Band constants are tunable; history must distinguish "the rules changed"
  -- from "you changed" (US-054 renders a marker when adjacent rows differ).
  rules_version text not null,
  previous_label text check (previous_label is null or previous_label in (
    'strong_apply', 'apply_with_improvements', 'learning_target', 'not_recommended'
  )),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Newest-first per match drives the latest-snapshot read and US-054 history.
create index if not exists analysis_decisions_match_idx
  on public.analysis_decisions (user_id, match_id, decided_at desc);

-- Cascade delete via user/match is the privacy/GDPR deletion path: snapshot
-- evidence text is resume-derived PII and dies with the user or match.
alter table public.analysis_decisions enable row level security;
