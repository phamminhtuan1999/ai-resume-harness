# US-070 Add Job Hub: Reframe Intake Page + Search AI Jobs Tab

## Status

planned

## Lane

normal

## Product Contract

There is one clear place to add a job. The current `/jobs/new` page is reframed
as the **Add Job** hub with three intake methods presented together: **Search AI
Jobs**, **Import Job URL**, and **Paste Job Description**. The user never has to
decide upfront whether to search, import, or paste — they pick a tab. Existing
URL import and manual paste behavior is preserved exactly; only the framing,
copy, and the new Search tab are added. Default tab is Search AI Jobs, because
ApplyWise is positioned as a career assistant that proactively finds
transition-friendly AI roles.

This story delivers the **shell only**: page title/subtitle, three tabs, and the
Search tab's placeholder/empty container. The Search tab's working behavior is
delivered by US-073/US-074/US-075; URL and Paste tabs keep their current
behavior.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 1, Section 6, 17)
- `PRODUCT.md` (honest coach register), `DESIGN.md` (tabs, page header)
- `docs/stories/period-6/` (existing URL intake), `docs/product/mvp-scope.md`

## Acceptance Criteria

- The intake page renders the title "Add Job to ApplyWise" and the subtitle
  about searching or importing and checking AI-path fit (Section 17 copy).
- Three intake tabs are shown: Search AI Jobs (default), Import Job URL, Paste
  Job Description. Selecting a tab shows that intake's form.
- Existing URL import (`job-url-form.tsx` → `importJobByUrlAction`) and manual
  paste (`job-form.tsx` → `saveJobAction`) continue to work unchanged under
  their tabs; no regression to either path.
- The route is reachable at its existing location; if a new `/jobs/add` route is
  introduced, the old entry point redirects to it (no broken links from `/jobs`,
  dashboard, or empty states).
- Until Search is implemented, the Search AI Jobs tab shows a clear
  coming-soon / placeholder state (never a fake or broken search), and the page
  remains fully usable via the other two tabs.
- Honest-coach register: no tab implies AI relevance has been judged yet; that
  only appears once the relevance gate (US-072+) runs.

## Design Notes

- Commands: none (no migration).
- Queries: none new.
- API: none new.
- Tables: none.
- Domain rules: tab framing only; the AI gate is added by later stories.
- UI surfaces: refactor `apps/web/src/components/forms/job-intake.tsx` from two
  modes to three tabs; reuse `job-url-form.tsx` and `job-form.tsx` as-is; update
  `apps/web/src/app/(app)/jobs/new/page.tsx` header/copy (and add/redirect
  `/jobs/add` if chosen). Follow `DESIGN.md` tab + page-header rules. Do not
  rework the URL/paste forms' internals.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-070 --unit 0 --integration 0 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tab state logic (default = Search; switching renders the right form). |
| Integration | n/a (no API change). |
| E2E | `/jobs/new` (or `/jobs/add`) shows three tabs; URL import still saves a job; manual paste still saves a job; Search tab shows the placeholder state. |
| Platform | n/a |
| Release | No regression in existing intake E2E. |

## Harness Delta

Intake #51. If `/jobs/add` is introduced, note the route rename in
`docs/product/` UX surface list. No decision required for the shell alone.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
