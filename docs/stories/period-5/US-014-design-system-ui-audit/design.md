# Design

## Domain Model

No domain model changes. This story preserves existing product entities:
profiles, resumes, jobs, matches, applications, and billing placeholders.

## Application Flow

No command or query behavior changes. Server pages keep using the current data
helpers and server actions.

## Interface Contract

Routes remain unchanged. Page presentation should become more consistent:

- Shared page headers for title, description, and actions.
- Shared empty states for list pages and workflow prompts.
- Shared card, badge, table, alert, button, input, and popup shape language.
- Public landing and pricing retain their current destinations.

## Data Model

No table, index, migration, or retention changes.

## UI / Platform Impact

The UI direction is quiet B2B SaaS:

- Design variance: 4.
- Motion intensity: 2.
- Visual density: 6.

Protected pages prioritize scan and repeated action over decorative layouts.
Public pages stay restrained and product-specific. The visual system should
avoid one-off radii, inconsistent badge shapes, oversized dashboard copy, and
implementation-only copy such as internal MVP labels where a user-facing label
is clearer.

## Observability

No new logs or analytics. Browser console inspection is required during visual
verification.

## Alternatives Considered

1. Full redesign. Rejected because the workflow is still evolving and the
   existing restrained SaaS direction is acceptable.
2. Page-by-page local styling. Rejected because the main problem is consistency,
   not a single page defect.
