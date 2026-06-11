# US-057 Structured Location and Phone Validation

## Status

implemented

## Lane

normal

## Product Contract

The career profile captures location as a **country chosen from a list** plus a
free-text **city**, and a **phone number validated against that country** and
stored normalized to E.164. The country drives both the phone region and the
"City, Country" string composed into `location_preference` (which the generated
CV and the profile display continue to read). Invalid phone numbers are rejected
with a country-specific message; an unknown country is rejected.

## Relevant Product Docs

- `docs/product/data-model.md` — `user_profiles` location/phone columns.
- `docs/decisions/0017-contact-validation-libphonenumber.md`.

## Acceptance Criteria

- The profile form shows a searchable country `<select>` (full ISO 3166 list,
  names via `Intl.DisplayNames`) and a free-text city input, replacing the old
  single free-text location field.
- A phone entered as a national number (e.g. `619 555 0199`) with country `US`
  saves as `+16195550199`; an international number (`+84 28 3822 9999`) saves
  even with no country selected.
- An invalid number for the selected country is rejected with
  "Enter a valid phone number for {Country}."; a national number with no country
  selected is rejected asking for a country or `+` prefix.
- `location_preference` is composed as "City, Country" (or just the country, or
  empty) and still feeds the CV contact and the identity card.
- Clearing a field stores `NULL`, not an empty string.

## Design Notes

- Commands: `saveProfileAction` (validate shape → `validateProfileContact` →
  normalize phone + compose location → write).
- Queries: profile selects add `location_city`, `location_country`.
- API: none (the API draft-CV path keeps reading `location_preference`/`phone`).
- Tables: `user_profiles` adds `location_city text`, `location_country text`
  (ISO alpha-2). `location_preference` kept as the composed display column.
- Domain rules: phone region = selected country; phone stored E.164; country
  must be a libphonenumber-supported code or empty.
- UI surfaces: `/profile` form (country select + city + phone hint), view mode
  and identity-card location read the composed string.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `contact-info.mjs`: COUNTRY_OPTIONS shape, `normalizePhone` (national+country, international no-country, invalid, empty), `composeLocation`, `validateProfileContact` field errors + normalized output. |
| Integration | Covered by E2E + the existing API draft-CV contact tests (unchanged). |
| E2E | `profile.spec.ts`: select country, fill city + national phone, save → DB has `location_country`, `location_city`, composed `location_preference`, E.164 `phone`. |
| Platform | n/a |
| Release | n/a |

## Harness Delta

Intake #45 (normal, change-request). Decision 0017 added for the dependency
choice. Migration `0023_profile_location_fields.sql`.

## Evidence

Added after verification (story update + trace).
