# US-020 Career Profile View/Edit Mode

## Status

planned

## Lane

normal

## Product Contract

The career profile page presents saved profile values as a read-only detail view
by default. The user enters edit mode explicitly via an Edit action, and the Save
profile action is only available in edit mode and only enabled once a value has
actually changed. This replaces the current always-editable form whose Save
button is enabled at all times.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`

## Background / Current Behavior

`apps/web/src/app/profile/page.tsx` renders `ProfileForm`
(`apps/web/src/components/forms/profile-form.tsx`) directly as an always-editable
form. `SubmitButton` (`apps/web/src/components/forms/submit-button.tsx`) only
disables while a submit is `pending`, so "Save profile" is effectively always
enabled and the page never shows a non-editable detail state. Expected behavior is
detail-first, with an explicit Edit step before any save.

## Investigation: App-Wide Scope (2026-06-08)

Audited every form and the page that renders it to find the same pattern
(an existing record loaded into an always-editable form with an always-enabled
save and no read-only detail step).

| Surface | Loads existing record | Pattern | Verdict |
| --- | --- | --- | --- |
| `/profile` -> `profile-form.tsx` | Yes | Always-editable, Save always on, no detail view | Primary fix (this story) |
| `tracker` -> `application-status-form.tsx` | Yes (current status) | "Update" enabled even when status is unchanged | Related minor fix (in scope) |
| `/jobs/[jobId]`, `/resumes/[resumeId]`, `/matches/[matchId]` | Yes | Read-only detail cards already | Correct, no change |
| `settings` | Yes | Read-only display + "Manage profile" link | Correct, no change |
| `/jobs/new`, `/resumes/new`, `/matches/new` | No (`defaultValue` absent) | Create forms | Correct, always-editable is intended |
| `save-application-form.tsx` ("Save to tracker"), AI generation forms (interview-prep, resume-draft, resume-suggestions, roadmap) | n/a | One-shot actions, not entity edits | Correct, no change |

Conclusion: `/profile` is the only surface that needs the detail-first + Edit
toggle. The tracker status dropdown is the only other "save enabled with no
change" instance and is folded in as a small dirty-guard fix. Detail pages and
create pages already behave correctly and are explicitly out of scope.

## Acceptance Criteria

- Given I have a saved profile, when I open `/profile`, then I see my profile
  values in a read-only detail view with an Edit action and no editable inputs.
- Given I am viewing the detail view, when I click Edit, then the fields become
  editable and Save profile and Cancel actions appear.
- Given I am in edit mode and have not changed any value, then Save profile is
  disabled.
- Given I am in edit mode and change a value, then Save profile becomes enabled;
  saving persists the change and returns me to the read-only detail view showing
  the updated values.
- Given I am in edit mode, when I click Cancel, then my edits are discarded and I
  return to the detail view unchanged.
- Given I have no saved profile yet, when I open `/profile`, then I begin in edit
  mode so I can create the profile (no empty read-only state blocks first save).
- (Related, tracker) Given I view an application's status control, when the
  selected status equals the saved status, then Update is disabled; when I pick a
  different status, then Update becomes enabled.

## Design Notes

- Commands: none new — reuse `saveProfileAction` in `apps/web/src/lib/actions.ts`.
- Queries: none new — profile already loaded in `app/profile/page.tsx`.
- API: unchanged. No server contract or schema change.
- Tables: unchanged (`user_profiles`).
- Domain rules: unchanged; target role still constrained to the accepted option
  set.
- UI surfaces: `/profile` page and `profile-form.tsx`.
- Implementation sketch:
  - Add client-side view/edit mode state. Render a read-only detail (reuse
    card/summary styling) by default; switch to the editable form on Edit.
  - Add a Cancel action that exits edit mode and resets fields to the loaded
    profile values.
  - Gate the Save button on a dirty check (current field values vs. the loaded
    profile) in addition to the existing `pending` guard. Extend `SubmitButton`
    usage with a `disabled` prop, or wrap with form dirty-state tracking.
  - On successful save, return to the detail view reflecting the new values.
- Related minor fix (`application-status-form.tsx`): gate the "Update" button on
  a dirty check so it is disabled while the selected status equals the saved
  status. This is the only other "save enabled with no change" instance found in
  the audit; same `SubmitButton` `disabled` mechanism applies.
- Out of scope (already correct): create pages `/jobs/new`, `/resumes/new`,
  `/matches/new` (no existing record to view); read-only detail pages
  `/jobs/[jobId]`, `/resumes/[resumeId]`, `/matches/[matchId]`, and `settings`;
  one-shot action and AI generation forms.
- Out of scope (deliberate flow): the resume-import review form
  (`profile-import-review-form.tsx`, "Save imported profile") is a
  review-then-confirm flow and keeps its always-available save.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-020 --unit 1 --integration 0 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Profile dirty-state gating: Save disabled when no field changed, enabled after a change; Cancel resets to loaded values. Tracker: Update disabled when status unchanged, enabled after change. |
| Integration | Not required — no server contract change. |
| E2E | Open `/profile` → read-only detail with Edit; click Edit → change a value → Save → return to detail showing updated values; Cancel discards edits. |
| Platform | Not required for local MVP proof. |
| Release | Period 6 smoke includes profile detail/edit toggle. |

## Harness Delta

No harness change expected.

## Evidence

Investigation evidence (current always-enabled behavior):

- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/components/forms/profile-form.tsx`
- `apps/web/src/components/forms/submit-button.tsx`
- `apps/web/src/components/forms/application-status-form.tsx` (related dirty-guard)

App-wide audit (2026-06-08) confirmed `/profile` is the only surface needing the
detail-first + Edit toggle; see "Investigation: App-Wide Scope" above.

Implementation and validation proof not yet present.
