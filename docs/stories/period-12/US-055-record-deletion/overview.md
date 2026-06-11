# Overview — US-055 Resume and Job Deletion

## Current Behavior

Resumes and jobs can be created, imported, parsed, and analyzed but never
deleted. The settings page states that deletion is intentionally unavailable.
Stale or test records accumulate forever and pollute lists, matches, and
dashboard counts.

## Target Behavior

The resume detail page and job detail page each carry a Delete control in the
header action row. Activating it expands an inline destructive confirm that
names the record and states the cascade ("Also permanently deletes its N
matches and all their analyses" / for jobs additionally tracker
applications). Confirming runs an owner-scoped hard delete, writes a
`resume.deleted` or `job.deleted` audit row to the activity feed, and
redirects to the corresponding list page with a success popup. A non-owned or
already-deleted id deletes nothing and reports "not found".

## Affected Users

- Account owner (single-tenant workspace).

## Affected Product Docs

- `docs/product/mvp-scope.md` — Period 12 row.
- `docs/product/data-model.md` — deletion and retention section.
- `docs/decisions/0016-deletion-and-retention.md`.

## Non-Goals

- Soft delete or restore windows (decision 0016).
- Deleting individual matches, analyses, or applications.
- Bulk deletion from list pages.
- Storage-object cleanup (`source_storage_path` is unused).
