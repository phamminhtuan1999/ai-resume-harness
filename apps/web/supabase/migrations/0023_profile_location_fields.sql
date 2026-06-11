-- Structured location for the career profile (US-057, decision 0017).
-- location_country holds an ISO 3166 alpha-2 code chosen from a list and drives
-- phone-number validation; location_city is free text. location_preference is
-- kept as the derived "City, Country" display string the generated CV reads, so
-- no API change or backfill is needed.
alter table public.user_profiles
  add column if not exists location_city text,
  add column if not exists location_country text;
