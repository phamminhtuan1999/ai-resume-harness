# Tracker Template Feature Inventory

Source: Notion page `Job Finder`
(`https://app.notion.com/p/Job-Finder-809dfe0e2fc08301ba40014ca30dff1b`),
read through the in-app browser on 2026-06-15.

Purpose: identify which features from the Notion Job Finder template should
inform ApplyWise Tracker improvements without replacing the existing product
contract.

## Source Template Summary

The Notion template is a job-search command center. It combines a job
application database, preparation links, status visualization, an interview
calendar, and external resource lists.

Observed source features:

- Hub page named `Job Finder` with a short motivational intro.
- Related pages linked from the top:
  - `Interview Preparation`
  - `CV`
  - `Cover Letter Template`
- Primary application database with a `Table` view.
- Database count: 5 sample entries.
- Table properties:
  - `Company`
  - `Position`
  - `Location`
  - `Flexibility`
  - `Status`
  - `Salary Range`
  - `Interview Date`
  - `In-touch Person`
  - `Notes`
- `Application Status` chart:
  - Pie chart grouped by `Status`.
  - Visible sample distribution: `Interviewing` 2, `Applied` 1, `Pass` 1,
    `Rejected` 1.
- `Interview Calendar` view:
  - Calendar view driven by interview dates.
- Resource sections:
  - Job search: LinkedIn, Indeed, Glassdoor, Monster, SimplyHired, FlexJobs.
  - Skill building: Udemy, Coursera, Skillshare.

The browser-rendered table did not expose the five sample row values as
readable text, so this inventory records only the visible schema, counts, views,
and resource sections.

## ApplyWise Fit

ApplyWise already has a stronger domain model than the Notion template:

- `jobs` stores company, title, location, work type, employment type, salary
  range, source URL, raw description, two structured payloads (`structured_json`
  and `extraction_json`), URL-intake metadata (`source`, `normalized_url`,
  `extraction_status`, `extraction_confidence`), and contact fields
  (`contact_name`, `contact_email`, `contact_linkedin_url`, `contact_notes`).
- `applications` stores tracker state, linked job, optional match, applied
  date, notes, and status.
- Tracker statuses are governed by decision
  `docs/decisions/0009-application-tracker-status-values.md`, not by the
  Notion template.
- Learning Targets are first-class tracker rows but are excluded from active
  application counts.

The Notion template is useful as a UX reference for a consolidated tracker
dashboard, not as a data-model source of truth.

## Feature Mapping

| Notion feature | ApplyWise equivalent | Recommendation |
| --- | --- | --- |
| Company | `jobs.company` | Already covered. Keep visible in tracker rows. |
| Position | `jobs.title` | Already covered. Keep as the primary row title with company secondary. |
| Location | `jobs.location` | Already covered. Keep visible and filterable. |
| Flexibility | `jobs.work_type` or `jobs.employment_type` | Use existing fields. Do not add a duplicate `flexibility` column. |
| Status | `applications.status` | Already covered. Keep ApplyWise status vocabulary. Do not import Notion sample statuses (see Non-Goals); if `Pass` is ever mapped, it means "passed over" and maps to `rejected`/`archived`, not `offer`. |
| Salary Range | `jobs.salary_range` | Already covered by the current job model. Surface in Tracker when present. |
| Interview Date | No dedicated current field | Candidate Tracker enhancement. Add only if interview scheduling becomes an accepted story. |
| In-touch Person | `jobs.contact_name`, `contact_email`, `contact_linkedin_url`, `contact_notes` | Already covered, and the tracker already shows contact name + LinkedIn (`tracker/page.tsx:129`). Remaining gap: surface `contact_notes`. |
| Notes | `applications.notes` and `jobs.contact_notes` | Already covered, but UI should clarify application notes vs contact notes. |
| Status pie chart | Tracker status summary | Per-status summary band already exists (`tracker/page.tsx:74`). Delta is a distribution chart (+ optional active/closed/learning rollups). |
| Calendar view | Interview date calendar | Good fit after an interview date field exists. Do not fake it from `applied_date`. |
| Prep/CV/Cover Letter links | Existing match detail tabs and generated artifacts | Already covered more deeply. Tracker can link directly to generated materials for each application. |
| Job board links | Planned Period 16 Search AI Jobs / URL / Paste intake | Use as inspiration for a resource or intake hub, but avoid manual outbound link clutter. |
| Skill building links | Existing roadmap and learning-target flow | Prefer personalized roadmap actions over generic course links. |

## Tracker Feature Candidates

> **Current `/tracker` baseline** (verified 2026-06-15 against
> `apps/web/src/app/(app)/tracker/page.tsx`). The page is not greenfield. It
> already renders a per-status summary band over `TRACKED_STATUSES`
> (`tracker/page.tsx:74`); a tracked-applications table with Job, Status,
> Contact (name + LinkedIn), Match score, Updated, and an inline status form;
> and a separate Learning Targets table that never enters the pipeline cards
> (`tracker/page.tsx:167`). Each candidate below is scoped to the **delta** over
> this baseline, not a from-scratch build.

### 1. Tracker Dashboard Summary

A summary band already exists — one count card per status in `TRACKED_STATUSES`
(`tracker/page.tsx:74`) — and learning targets are already held out in their own
table. The delta is small and optional:

- Add grouped **rollup** counts (one Active total, one Closed total). Decide
  whether these replace the current per-status cards or sit alongside them; the
  per-status cards are arguably more useful, so this may not be worth doing.
- Add a **Learning target count** card (today the count is implied by the
  separate table but never shown as a number).

Use existing status groups from `apps/web/src/lib/application-tracker.mjs`:

- Active (`pipeline`): `saved`, `prepared`, `applied`, `interviewing`, `offer`.
- Closed: `rejected`, `archived`.
- Learning: `learning_target`.

Do not count learning targets as active applications (already enforced by
`partitionApplications` / `countActiveApplications`).

### 2. Status Distribution Chart

This is the genuinely new analytics piece — the band in #1 already exists, but a
distribution chart does not. Add a visualization modeled after the Notion pie
chart, with ApplyWise semantics:

- Group by `applications.status`.
- Display label values from the shared helper
  (`apps/web/src/lib/application-tracker.mjs`).
- Include a separate segment or filter for Learning Targets.
- Empty state: show a quiet message when no tracker rows exist.

`apps/web/src/components/charts/` already holds `ats-gauge`, `radar-chart`, and
`score-trend-chart` — none is a status distribution, but reuse the same charting
approach rather than adding a new dependency. This is a UX-only enhancement if it
reads existing tracker rows.

### 3. Interview Date Tracking

The Notion template has `Interview Date`; ApplyWise currently has
`applications.applied_date` but no dedicated interview event date.

An `interview_preps` table already exists (migration `0006`, keyed by
`match_id`) — it holds interview *prep content*, not a scheduled date, so it is a
related but distinct concept. Do not overload it with scheduling.

Open placement decision: interview data today hangs off the **match**
(`interview_preps.match_id`), while a tracker date arguably belongs on the
**application**. Resolve where the new fields live before implementing — not
every tracker row has a match.

Candidate fields if accepted:

- `interview_date date`
- `interview_stage text`
- `interview_notes text`

Risk note: adding these fields touches data model, migrations, tracker UI,
validation, and possibly reminders. Treat implementation as normal or high-risk
depending on whether notifications/calendar integration are included.

### 4. Interview Calendar View

Only add a calendar after interview dates exist.

Recommended behavior:

- Month view on `/tracker` or a tracker tab.
- Events are tracker rows with `interview_date`.
- Clicking an event opens the linked job/tracker detail.
- No external calendar sync in the first slice.

Avoid using `applied_date` as a substitute for interviews; it would conflate
application submission with interview scheduling.

### 5. Contact Follow-Up Surface

The Notion `In-touch Person` field maps well to ApplyWise contact fields, and the
tracked table already surfaces them: contact name via `getContactLabel` and a
LinkedIn link are rendered today (`tracker/page.tsx:129`). The remaining gaps:

- Surface **contact notes** (stored on `jobs.contact_notes` but not shown on the
  tracker) with a clear label that distinguishes them from application notes.
- Optionally add `last_contacted_at` and `next_follow_up_at` in a later story
  (these fields do not exist yet).

Do not duplicate contact data into `applications` unless there is a clear
reason; the current source belongs to `jobs`.

### 6. Application Materials Shortcuts

This is the **least-built** candidate and therefore the highest marginal value.
Today the tracked table exposes only Job and Match links plus the inline status
form (`tracker/page.tsx:152`); only the Learning Targets table has a per-row
artifact link (4-Week Roadmap, `tracker/page.tsx:213`). The Notion page links to
CV and cover-letter templates globally; ApplyWise has match-specific generated
artifacts, so Tracker shortcuts should be row-specific:

- Open job analysis.
- Open draft CV.
- Open cover letter.
- Open interview prep.
- Open roadmap for learning targets.

These shortcuts should respect existing material readiness and Truth Guard
states.

### 7. Tracker Resource Panel

The Notion template includes job-search and skill-building links. For ApplyWise,
the more product-native version is:

- Link to Add Job / Search AI Jobs once Period 16 is implemented.
- Link to saved jobs needing analysis.
- Link to learning-target roadmaps.
- Keep generic external links secondary or omit them.

Avoid presenting third-party job boards as if ApplyWise integrates with them
unless a provider integration exists.

## Suggested Story Slices

These are pre-intake candidates, not accepted stories — no story files exist yet.
Vet each before implementation. Ordered by
marginal value (the most-already-built work is sequenced last).

### 1. Tracker Contact And Materials Shortcuts

Goal: make each tracker row more actionable. This is the biggest gap over the
current page and needs no schema change.

Lane: normal (UI plus read-only data; no migration).

Scope:

- Surface contact notes (the gap) alongside the contact name/LinkedIn already
  shown.
- Add row actions to job detail, job analysis, draft CV, cover letter,
  interview prep, and roadmap when relevant.
- Do not add new database fields.

Validation:

- Unit tests for action availability by status and match/artifact state.
- Integration test for owned tracker row with linked job and match.
- Browser check on `/tracker`.

### 2. Tracker Analytics Delta

Goal: add the analytics the page is missing. The per-status summary band already
exists, so scope is the distribution chart plus optional grouped rollups.

Lane: normal (UI-only if it reads existing rows).

Scope:

- Read existing `applications` rows.
- Add a status distribution visualization and, optionally, Active/Closed rollup
  counts and a learning-target count card.
- Preserve current status vocabulary and learning-target exclusions.

Validation:

- Unit tests for status grouping and counts.
- Integration test for tracker loader aggregation.
- UI test or browser check for empty, active, closed, and learning states.

### 3. Interview Dates And Calendar

Goal: support interview scheduling inside Tracker. Sequence this last — it is the
only slice that changes persisted state.

Lane: normal with stronger validation, escalating to high-risk if reminders or
calendar sync are included (data-model hard gate).

Scope:

- Resolve placement first: application vs. match (see Candidate #3) against the
  existing `interview_preps` table.
- Add interview date/stage fields to tracker state.
- Render an interview calendar view.
- Keep external calendar sync out of scope.

Validation:

- Migration proof.
- Server validation for nullable dates/stages.
- Integration tests for create/update/read.
- Browser check for calendar rendering and row navigation.

Risk:

- This is larger than a visual enhancement because it changes persisted tracker
  state.

## Non-Goals

- Do not replace ApplyWise statuses with the Notion sample statuses.
- Do not add a duplicate `flexibility` field.
- Do not make generic job-board links the main intake workflow.
- Do not treat the Notion `CV` and `Cover Letter Template` pages as substitutes
  for ApplyWise generated, truth-guarded artifacts.
- Do not add calendar sync or reminders in the first Tracker feature slice.

## Recommended Next Step

Start with `Tracker Contact And Materials Shortcuts` — it is the largest gap over
the current page, needs no data-model change, and makes every tracker row more
actionable. Then add the `Tracker Analytics Delta` (distribution chart plus
optional rollups; the per-status band already exists). Leave `Interview Dates And
Calendar` last because it requires persisted fields, validation, and a placement
decision against the existing `interview_preps` table.
