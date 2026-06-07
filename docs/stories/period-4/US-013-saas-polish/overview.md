# Overview

## Current Behavior

US-012 implemented the persisted application tracker. Remaining Period 4
surfaces are uneven: `/` redirects into the protected app instead of serving a
public landing page, `/settings` contains placeholder account data and inactive
destructive buttons, and pricing lacks story-level proof even though the page
exists.

## Target Behavior

Period 4 is complete when the MVP has:

- A public landing page at `/`.
- A pricing placeholder that clearly disables payment.
- A protected settings page using live account/workspace data.
- Demo-flow polish that reflects implemented MVP modules instead of stale
  planned states.

## Affected Users

- Signed-out visitors evaluating ApplyWise.
- Signed-in users reviewing account and workspace state.
- Demo reviewers walking the full MVP flow.

## Affected Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`

## Non-Goals

- Real checkout or Stripe integration.
- Account, resume, or job deletion.
- Public portfolio generation.
- Analytics dashboards.
