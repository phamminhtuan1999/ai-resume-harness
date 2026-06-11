# 0017 Contact Validation with libphonenumber-js

Date: 2026-06-11

## Status

Accepted

## Context

The career profile's location was a single free-text field and the phone was an
unvalidated string (US-019 contact work). The owner asked for a country picker
and phone validation/formatting driven by the selected location, so generated
CVs carry a clean, correctly formatted number and a structured location.

Two implementation forks were decided with the owner:

1. **Location picker** — a country `<select>` (full ISO 3166 list) plus a
   free-text city, rather than a full city-autocomplete dataset or a geocoding
   API.
2. **Phone** — validate and normalize with `libphonenumber-js` rather than a
   hand-rolled calling-code-prefix heuristic.

## Decision

- Add `libphonenumber-js` (the maintained port of Google's libphonenumber) as a
  web dependency. Use it to validate a phone against the selected country and
  store it normalized to E.164; the same package supplies the supported-country
  list and calling codes.
- Render country **names** with the runtime's built-in `Intl.DisplayNames`
  (`type: "region"`), so no country-name dataset is shipped.
- Store structured inputs in two new nullable columns, `location_city` and
  `location_country` (ISO alpha-2). Keep `location_preference` as a **derived**
  column composed as "City, Country" on save, so the API draft-CV path and the
  profile display keep working unchanged (no API change, no backfill required).
- Phone region is the selected country. A number with no country selected is
  accepted only if it is already in international (`+`) format. Cleared fields
  persist `NULL`.
- All pure logic (country options, `normalizePhone`, `composeLocation`,
  `validateProfileContact`) lives in `contact-info.mjs`, imported by the profile
  form and the save action only — kept out of `action-validation.mjs` so the
  library is not bundled into unrelated client forms.

## Alternatives Considered

1. Full city autocomplete (cities dataset or geocoding API) — rejected: heavy
   payload / network dependency and ongoing data maintenance for marginal gain.
2. Lightweight no-dependency phone check (calling-code prefix + digit count) —
   rejected: misses most invalid numbers and only approximates formatting.
3. Replacing `location_preference` with the two structured columns everywhere
   (incl. the API) — rejected for now: keeping it as a derived column avoids an
   API change and a data backfill.

## Consequences

Positive:

- Correct, E.164-normalized phone numbers on generated CVs.
- Structured, round-trippable location with zero country-name dataset.
- No API or migration-backfill churn (`location_preference` stays the contract).

Tradeoffs:

- New runtime dependency (~30KB min) on the client where the form renders.
- Legacy rows have null `location_country`/`location_city`; the user re-picks
  the country once on next edit (their old free-text `location_preference` still
  displays until then).

## Follow-Up

- If full city resolution is wanted later, layer an autocomplete over the same
  `location_country` without changing storage.
