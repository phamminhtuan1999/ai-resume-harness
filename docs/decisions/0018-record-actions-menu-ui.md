# 0018 Record Actions Menu, Modal Confirm, and Post-Redirect Flash

Date: 2026-06-11

## Status

Accepted

## Context

US-055 shipped record deletion as an inline two-step "Delete" button on the
resume/job **detail** pages only. The owner asked to (1) expose record actions
directly on the list surfaces via a three-dot (⋯) kebab menu with View / Edit /
Delete, (2) replace the inline confirm with a confirmation **modal** (Confirm /
Cancel), and (3) show a **flash message** once the action completes.

Two facts shaped the design:

- The repo has **no edit flow** for jobs or resumes — they are import-and-view
  records with no edit routes or forms. A "Edit" menu item therefore had no
  destination.
- The web app already depends on **Base UI** (`@base-ui/react`, the successor to
  Radix) for its Button/Input primitives, but had no Menu or Dialog wrapper. The
  repo hand-rolls some primitives and wraps Base UI for others; there is no
  toast/notification library.

## Decision

- **Primitives on Base UI, not a new dependency.** Add thin styled wrappers
  `ui/dropdown-menu.tsx` (Base UI `Menu`) and `ui/alert-dialog.tsx` (Base UI
  `AlertDialog`). Base UI supplies focus trap, keyboard nav, portal, and ARIA;
  `AlertDialog` (vs `Dialog`) is not outside-click dismissable, which suits a
  destructive confirm. No toast library is introduced.
- **Edit = lightweight rename.** Rather than ship a dead "Edit" link or build
  full edit pages, Edit opens a modal that edits only the safe **display**
  fields — job: `title` + `company`; resume: `title`. Canonical parsed content
  (`raw_text`, structured extraction) is never written by this path. New
  owner-scoped `updateJobAction` / `updateResumeAction`; job rename validated by
  a new `jobRenameSchema`, resume rename reuses the existing `resumeTitleSchema`.
- **One confirm modal, two entry points.** `DeleteRecordDialog` is shared by the
  detail-page button (`DeleteRecordButton`, now a trigger + modal) and the list
  kebab (`RecordActionsMenu`). The detail page passes the **precise**,
  count-aware blast-radius summary (it already fetches impact); the list passes a
  **generic** count-free summary (`jobDeletionSummaryGeneric` /
  `resumeDeletionSummaryGeneric`) to avoid an N+1 impact query per row.
- **Flash via a non-PII redirect code.** Delete and rename actions
  `redirect("/jobs?flash=job-deleted")` (and the resume/updated variants). A
  `FlashToast` client component maps the short code to a fixed message, shows a
  3.2s toast, and strips the param with `history.replaceState` (not
  `router.replace`, which would re-render the server component and drop the
  toast). The code is a fixed enum — never the record's name — so no personal
  data lands in the URL.
- **Menu→modal handoff.** Dialogs render as siblings of the menu, driven by
  state, and open is deferred one tick (`setTimeout(…, 0)`) so the menu's focus
  restoration settles before the modal traps focus.

## Alternatives Considered

1. Hand-roll the dropdown and modal — rejected: re-implements focus
   trap/roving-tabindex/ARIA that Base UI already provides and the repo already
   ships.
2. Add a toast library (sonner/react-hot-toast) — rejected: unnecessary
   dependency; the existing `FormSuccessPopup` visual + a redirect code cover it.
3. Drop "Edit" (View + Delete only) — viable and honest, but the owner asked for
   three actions; rename delivers real value without a full edit feature.
4. Build full edit pages for jobs/resumes — rejected for now: a separate
   feature far larger than this menu work.
5. Precise per-row delete counts on the list — rejected: an N+1 impact query (or
   loading applications into every workspace page) for copy that is equally
   truthful when generic.

## Consequences

Positive:

- Delete/rename reachable in one click from the lists; consistent modal confirm
  and flash across detail and list surfaces.
- No new runtime dependency; reuses Base UI and existing form/action plumbing.
- Owner-scoped rename with no risk to canonical content; no schema change.

Tradeoffs:

- List delete copy is generic (no exact counts); detail pages keep exact counts.
- Two summary code paths (precise vs generic) to keep in sync.

## Follow-Up

- If a full job/resume edit feature is built later, the kebab's Edit item can
  point at it instead of the rename modal without changing the menu.
