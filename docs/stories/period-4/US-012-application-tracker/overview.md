# Overview

## Current Behavior

The tracker page renders saved job descriptions as placeholder cards and shows
every job as `Saved`. It does not persist application workflow state.

## Target Behavior

Users can save a job or matched job into the application tracker, see real
tracker rows, update the status through the workflow, receive success feedback,
and return to the tracker list view after saving.

## Affected Users

- Signed-in ApplyWise users managing job applications.

## Affected Product Docs

- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/architecture.md`

## Non-Goals

- Application analytics.
- External job-board sync.
- Recruiter outreach automation.
- Payment or pricing changes.
