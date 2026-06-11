# Overview — US-056 Account Deletion

## Current Behavior

The settings page shows account identity and workspace record counts, plus an
alert stating that deletion is intentionally unavailable in the MVP. There is
no way to erase the account or its data.

## Target Behavior

The settings page replaces that alert with a Danger zone card. It explains
exactly what deletion covers (every workspace record and the sign-in
account), requires the user to type `DELETE` before the destructive button
enables, and on confirm: purges the `user_profiles` row (cascading every
workspace table), deletes the Clerk user, and lands the signed-out visitor on
the marketing page. The flow is the GDPR-style full-erasure path from
decision 0016.

## Affected Users

- Account owner. Irreversibly.

## Affected Product Docs

- `docs/product/mvp-scope.md` — Period 12 row.
- `docs/product/data-model.md` — deletion and retention section.
- `docs/decisions/0016-deletion-and-retention.md`.

## Non-Goals

- Grace periods, scheduled erasure, or account recovery.
- Data export before deletion.
- Deleting only app data while keeping the sign-in (owner rejected).
