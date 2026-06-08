# Overview

## Current Behavior

ApplyWise forms had required attributes and popup success feedback, but field
validation was uneven. Server actions returned form-level messages even when the
failure belonged to a specific field, and helper text was repeated locally or
missing across forms.

## Target Behavior

All ApplyWise forms should expose required constraints, helper text, field-level
errors, form-level alerts, pending states, success popups, and post-create
navigation where the flow creates or redirects to a destination.

## Affected Users

- Signed-in job seekers adding profiles, resumes, jobs, matches, and tracker
  updates.
- Demo reviewers validating the workflow without guessing why a form failed.
- Local developers integrating the resume import API and Docling conversion.

## Affected Product Docs

- `docs/product/ui-ux-quality.md`
- `docs/product/overview.md`
- `docs/product/mvp-scope.md`

## Non-Goals

- Do not change persistence schema, auth, billing, AI scoring, or generated
  content behavior.
- Do not replace the existing success popup or navigation flow.
- Do not implement mobile navigation rework; that belongs to `US-016`.
