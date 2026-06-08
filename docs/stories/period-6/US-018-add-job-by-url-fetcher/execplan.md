# Exec Plan

## Goal

Add a safe Firecrawl-backed job URL intake flow with manual paste fallback and
duplicate protection.

## Scope

In scope:

- Add URL mode to job creation UI.
- Validate submitted job URL.
- Normalize URL and reject duplicates for the same user.
- Add Firecrawl backend client and provider configuration.
- Convert fetched content into markdown or structured text.
- Run AI job extractor with strict JSON schema.
- Validate extracted fields before persistence.
- Save job with source `manual_url`.
- Run match scoring against the active candidate profile when enough profile
  and resume context exists.
- Show fetched job in jobs list with score and status.
- Show manual paste fallback when fetch fails.

Out of scope:

- Browserbase workflows.
- Apify actors and job feed discovery.
- LinkedIn login automation.
- Chrome extension support.

## Risk Classification

Risk flags:

- Cross-platform.
- Existing behavior.
- External provider.
- Auth protected data.
- AI output validation.
- Database migration likely.
- Weak proof until fixture coverage exists.

## Work Phases

1. Data model: add job source, normalized URL, extraction metadata, and score
   display fields if needed.
2. Backend API: add protected job URL fetch endpoint and Firecrawl client.
3. AI extraction: add strict schema, prompt, validation, and retry-on-invalid.
4. Web UI: add Add Job by URL mode with fallback to manual paste.
5. Persistence/scoring: save extracted job and run deterministic match scoring.
6. Verification: unit, API integration, database duplicate checks, browser E2E,
   provider-failure fallback, and build.
7. Harness update: mark proof flags and record trace.

## Stop Conditions

Pause for human confirmation if:

- Firecrawl credentials or billing limits are missing.
- Provider terms block a target job-board source.
- The story needs to persist fetched HTML beyond normalized job text.
- Scoring cannot run because active candidate profile selection is undefined.
