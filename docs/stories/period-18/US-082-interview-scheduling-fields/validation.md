# Validation - US-082 Tracker Interview Scheduling Fields

## Proof Strategy

Prove that interview scheduling fields are additive, ownership-safe, and do not
change tracker status semantics.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Validation accepts empty fields, valid dates, supported stage values if constrained, and rejects invalid date payloads. Learning Target count rules ignore interview fields. |
| Integration | Migration applies cleanly; owned row can update interview fields; another user's row is denied without data leakage; status update still works; `applied_date` remains distinct. |
| E2E | Browser check on `/tracker`: add interview date/stage/notes, save, reload, verify persistence and unchanged status grouping. |
| Platform | Build/lint/test commands pass after migration and generated types are updated. |
| Performance | Calendar-ready query over `(user_id, interview_date)` remains bounded if an index is added. |
| Logs/Audit | Existing request logging remains canonical; activity event covered only if implemented. |

## Fixtures

- User A with tracker row in `applied`.
- User A with tracker row in `learning_target`.
- User B with a tracker row for ownership-denial proof.
- Row with null interview fields.
- Row with a future interview date.

## Commands

Add commands after scripts exist.

```text
TBD
```

## Acceptance Evidence

Implemented as additive nullable fields on `applications` (first slice — no
separate event table, single round per row).

- **Migration (hard gate):** `apps/web/supabase/migrations/0032_period18_interview_scheduling_fields.sql`
  applied to Supabase via `psql $SUPABASE_DB_URL`. Verified: `information_schema`
  reports `interview_date date`, `interview_stage text`, `interview_notes text`
  all nullable; `pg_indexes` reports
  `applications_user_interview_date_idx (user_id, interview_date) WHERE interview_date IS NOT NULL`.
- **Unit:** `apps/web/tests/interview-schedule.test.mjs` (10 tests) — stage
  vocabulary/labels, strict date validity (`2026-02-31` rejected), normalizer
  accepts empty→null, accepts a full schedule, rejects invalid date / unknown
  stage / over-long notes, reports multiple field errors, `hasInterviewSchedule`,
  and a Learning Target with interview fields stays out of the active count.
- **Domain/ownership:** `updateInterviewScheduleAction` runs through
  `requireWritableContext` and updates with `.eq("user_id", …)` — another user's
  row is denied without revealing existence (same proven path as
  `updateApplicationStatusAction`). Saving interview details never touches
  `status` or `applied_date`.
- **UI:** `InterviewScheduleForm` (date + stage + notes, dirty-tracked) wired
  into a new Interview column on the `/tracker` tracked table; distinct error
  copy for invalid date vs. save failure.
- **Build/lint/test:** full web suite **389 passed**; `tsc --noEmit` + `eslint`
  clean.

Not yet automated: server-action/DB integration and browser-persistence E2E —
the web app has no server-action integration harness, and the route is
Clerk-gated (verified in a real browser). Tracked as the natural follow-up.

