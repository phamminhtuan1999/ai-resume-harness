-- US-043 Draft CV rendering recommendation storage (Period 10, Rendering
-- Rework). Additive only: rendering metadata lives beside the content-only
-- cv_json. Shape: { recommendation: { recommended_page_count,
-- page_count_reason, font_profile, layout_density, compression_strategy[] },
--   page_policy: { target_pages, max_pages, yoe, yoe_source, basis,
--   seniority_signal, exceptional, evidence_volume, notes[] },
--   model_recommendation: { pre-clamp values for audit } }.
-- Null on pre-0019 rows -> renderers use legacy defaults (modern_latex, no
-- page targeting) and the UI offers regeneration. See
-- docs/decisions/0014-draft-cv-rendering-rework.md.

alter table public.draft_cvs
  add column if not exists rendering_json jsonb;
