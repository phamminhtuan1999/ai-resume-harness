-- US-028 AI Match Analyzer (Period 8, Feature 1).
-- Additive AI-analysis columns on matches. The existing deterministic columns
-- (overall_score, sub-scores, strengths_json, weaknesses_json,
-- missing_skills_json, risks_json, explanation_json) are preserved so existing
-- readers keep working; the new columns carry the evidence-based Gemini output.
-- Generation runs on the server (apps/api) under the Supabase service role after
-- Clerk identity + ownership checks. See docs/decisions/0012-ai-workflow-standards.md.

alter table public.matches
  add column if not exists apply_recommendation text
    check (apply_recommendation is null or apply_recommendation in (
      'apply_now', 'apply_with_improvements', 'improve_first', 'not_recommended'
    )),
  add column if not exists assistant_summary text,
  add column if not exists fit_reasoning text,
  add column if not exists score_explanations_json jsonb,
  add column if not exists top_strengths_json jsonb,
  add column if not exists top_gaps_json jsonb,
  add column if not exists next_best_action text,
  add column if not exists seniority_match_label text,
  add column if not exists location_score integer
    check (location_score is null or location_score between 0 and 100),
  add column if not exists confidence_score numeric,
  add column if not exists analyzer_provider text
    check (analyzer_provider is null or analyzer_provider in (
      'gemini', 'deterministic'
    ));
