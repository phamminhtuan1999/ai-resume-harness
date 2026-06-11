# US-058 Record Actions Menu, Modal Confirm, and Flash

## Status

implemented

## Lane

normal

## Product Contract

Every job and resume row on its list surface carries a three-dot (⋯) **actions
menu** with **View**, **Edit**, and **Delete**. Delete (from the list or the
detail page) opens a **confirmation modal** that states the blast radius before
the destructive button; on completion the user lands on the list with a brief
**flash** toast. Edit opens a modal to **rename** the safe display fields (job:
role title + company; resume: title) without touching canonical parsed content.

## Relevant Product Docs

- `docs/decisions/0018-record-actions-menu-ui.md`.
- `docs/decisions/0016-deletion-and-retention.md` (deletion policy, US-055/056).

## Acceptance Criteria

- The `/jobs` table has an actions column and `/resumes` cards show a ⋯ menu;
  each menu has View (→ detail), Edit (→ rename modal), Delete (→ confirm modal).
- Delete shows a modal stating the cascade; "Delete permanently" hard-deletes
  (owner-scoped, audit row written) and redirects to the list; "Cancel" closes
  with nothing deleted.
- The detail-page "Delete job/resume" button opens the **same** confirm modal
  (no more inline two-step) and redirects to the list on success.
- After a delete or rename, the destination list shows a flash ("Job deleted.",
  "Resume deleted.", "Job updated.", "Resume updated.") that auto-dismisses; the
  flash param carries no record name and is stripped from the URL.
- Edit renames only `title` (+ `company` for jobs); blank title/company is
  rejected with a field error; the parsed description / canonical text is
  unchanged.
- Rename and delete are owner-scoped: a non-owned or missing id changes nothing.

## Design Notes

- Commands: new `updateJobAction`, `updateResumeAction` (owner-scoped update →
  revalidate → redirect with flash code). `deleteJobAction`/`deleteResumeAction`
  now redirect with a flash code. Rename validated by `jobRenameSchema` /
  `resumeTitleSchema`.
- Queries: none added — list delete uses a count-free generic summary to avoid an
  N+1 impact query per row; detail pages keep the precise count summary.
- API: none.
- Tables: none (no schema change).
- UI: `ui/dropdown-menu.tsx` + `ui/alert-dialog.tsx` (Base UI wrappers);
  `forms/record-actions-menu.tsx`, `forms/delete-record-dialog.tsx`,
  `forms/edit-record-dialog.tsx`, `forms/flash-toast.tsx`;
  `forms/delete-record-button.tsx` reworked to open the shared modal.
- Domain rules: flash codes are a fixed enum (no PII in URL); dialog open is
  deferred a tick after the menu closes for clean focus handoff.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `deletion-view.test.mjs`: generic summaries are count-free + warn about the cascade. `action-validation.test.mjs`: `validateJobRenameInput` requires title + company, trims. |
| Integration | Covered by E2E (server actions exercised through the UI + DB readback). |
| E2E | `deletion.spec.ts`: detail delete (job cascade + resume) now asserts the flash + pathname; list kebab delete (DB readback) and list kebab rename (flash + new title) added; cancel + account-gate unchanged. |
| Platform | n/a |
| Release | n/a |

## Harness Delta

Intake #46 (normal, change-request). Decision 0018 added for the UI primitive
choice (Base UI Menu/AlertDialog), the rename-as-Edit scope, and the
flash-via-redirect-code pattern. No migration.

## Evidence

Added after verification (story update + trace).
