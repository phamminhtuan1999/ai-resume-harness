# Design

## Domain Model

No new domain entities are introduced. Settings summarizes existing profile,
resume, job, match, and tracker records.

## Application Flow

- Signed-out users can land on `/`, inspect product positioning, navigate to
  `/pricing`, `/sign-in`, or `/sign-up`.
- Pricing shows Free and Pro positioning with disabled `Coming soon` controls.
- Signed-in users can open `/settings` to review Clerk/profile identity and
  workspace record counts.
- Dashboard AI workflow labels reflect implemented MVP modules.

## Interface Contract

Public routes:

- `/`
- `/pricing`

Protected route:

- `/settings`

No route starts checkout, collects payment details, or performs destructive
data operations.

## Data Model

No data-model changes.

## UI / Platform Impact

The landing page uses a full-viewport product scene and keeps the next section
visible. Settings replaces fake account copy with live user/profile data and
non-destructive MVP guidance.

## Observability

No new logs. Harness trace records tests, browser checks, and build output.

## Alternatives Considered

1. Keep `/` redirecting to `/dashboard`. Rejected because the product contract
   lists `/` as public.
2. Leave destructive settings buttons disabled-looking. Rejected because fake
   destructive controls create demo confusion and imply unavailable behavior.
