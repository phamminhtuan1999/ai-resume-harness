# Exec Plan — US-052 Learning Target Tracker Flow

## Goal

Give weak-but-relevant roles a first-class learning-target home in the
tracker without distorting application pipeline data.

## Scope

In scope:

- Additive migration: `learning_target` in the `applications.status` CHECK
  constraint.
- Decision `0009` refresh + durable decision row update.
- Save as Learning Target action (API path + web server action) creating or
  re-statusing the tracker row.
- Exclusion of learning targets from active-application counts (dashboard
  summary, tracker pipeline views) + a Learning Targets filter/segment and
  display label.
- Status-transition rules and validation list updates (shared status
  helpers, forms, tests).
- Roadmap linkage: learning-target rows surface a Generate/View Roadmap
  affordance for their match.

Out of scope:

- Rendering of the Save as Learning Target button placement (US-049 owns the
  action panel; this story provides the behavior behind it).
- Decision-engine classification (US-047).
- Roadmap content changes (US-034 unchanged).
- Notifications, reminders, or progress tracking on learning targets.

## Risk Classification

Risk flags:

- Data model: CHECK-constraint migration on `applications`.
- Existing behavior: US-012 tracker workflow and counts change.
- Public contracts: status vocabulary is client-visible and validated in
  forms/server actions.

Hard gates:

- Data model migration → high-risk lane.

## Work Phases

1. Discovery: enumerate every consumer of the status list (shared helper,
   forms, dashboard counts, tracker filters, tests, CHECK constraint).
2. Design: transition rules + count semantics; refresh decision 0009 text.
3. Validation planning: count-exclusion and transition matrices.
4. Implementation: migration → shared status list → API/action → tracker UI
   filter → dashboard exclusion.
5. Verification: pytest + web tests; migration applied to the live Supabase
   DB via `psql` + `SUPABASE_DB_URL`; REST-reachability + constraint check.
6. Harness update: matrix proof, product docs, decision row
   (`scripts/bin/harness-cli decision add`/refresh), trace.

## Stop Conditions

Pause for human confirmation if:

- Any consumer treats unknown statuses destructively (e.g. filters that drop
  rows silently) — surface before migrating.
- Dashboard count semantics are ambiguous (does "saved" count as active?
  preserve current semantics, only exclude `learning_target`).
- The unique `(user_id, job_id)` tracker rule conflicts with saving a
  learning target for a job that already has a pipeline row (planned: the
  row re-statuses only on explicit confirm; never silently).
