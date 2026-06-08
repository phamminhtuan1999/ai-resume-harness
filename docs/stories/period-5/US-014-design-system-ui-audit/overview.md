# Overview

## Current Behavior

ApplyWise has the MVP workflow wired across public and protected pages, but UI
patterns are still page-local in several places. Headings, empty states, cards,
tables, badges, and page actions work, but they do not yet share one durable
presentation contract.

## Target Behavior

ApplyWise should use a consistent restrained SaaS visual system across landing,
pricing, dashboard, list, detail, tracker, profile, and settings surfaces.
Shared UI primitives should carry the shape, spacing, and state language where
possible.

## Affected Users

- Signed-out visitor comparing landing and pricing.
- Signed-in job seeker scanning workspace status, resumes, jobs, matches, and
  tracker state.
- Demo reviewer checking visual consistency and responsive behavior.

## Affected Product Docs

- `docs/product/ui-ux-quality.md`
- `docs/product/overview.md`
- `docs/product/mvp-scope.md`

## Non-Goals

- Do not change AI scoring, generated content, persistence, auth, or billing
  behavior.
- Do not add new data schema or migrations.
- Do not implement the full field-level validation rework; that belongs to
  `US-015`.
