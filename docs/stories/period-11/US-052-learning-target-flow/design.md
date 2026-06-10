# Design — US-052 Learning Target Tracker Flow

Planning-stage design; frozen at implementation start.

## Domain Model

- `ApplicationStatus` gains `learning_target` (storage value; display label
  "Learning Target"). One shared status helper remains the single source for
  valid values, display labels, and grouping.
- Status groups: `pipeline = saved | applied | interviewing | offer`,
  `closed = rejected | archived`, `learning = learning_target`. "Active
  applications" = current definition, now explicitly excluding `learning`.
- `learning_target` is the **only** new status value. The US-049
  "Save as Reference" action (Not Recommended roles) reuses the existing
  `archived` status with a note (decision 0015 §4) — it is not a new value and
  needs no migration here; like all closed statuses it is excluded from active
  counts.
- Transition rules (validated server-side, same place existing transitions
  are validated): any → `learning_target` and `learning_target` →
  `saved | applied | archived` are allowed via explicit user action;
  `learning_target` is never set automatically.

## Application Flow

- Command: save-as-learning-target (job_id, match_id) → upsert the unique
  `(user_id, job_id)` application row with status `learning_target`; when a
  row exists in a pipeline status, require explicit confirm before
  re-statusing (no silent demotion). The save also **asserts directional
  relevance** for the match (decision 0015 §3 signal 1): on later recomputes
  the affinity heuristic treats the role as relevant — the user, not the
  token heuristic, owns their direction. The action is offered for
  `not_recommended` matches too (US-049 placement table).
- Command: existing status-update flow accepts the new value through the
  shared validation list.
- Query: tracker list gains a `learning_target` filter/segment; dashboard
  summary counts exclude the learning group from active-application
  numbers.
- Roadmap linkage: learning-target rows with a `match_id` expose
  Generate/View 4-Week Roadmap routing to the existing
  `/matches/[matchId]/roadmap` surface (US-034 workflow already focuses on
  missing critical skills via the gap analysis input).

## Interface Contract

- Reuse the existing tracker save/update API/server-action shape with the
  extended status vocabulary; if a dedicated convenience endpoint is added
  (`POST /api/applications/learning-target`), it is a thin wrapper over the
  same upsert (decided at implementation review).
- Validation errors for invalid transitions reuse the existing error
  envelope.
- Brief Epic 9 acceptance "not counted as an active application" is a
  contract on every count surface: dashboard summary tiles and tracker
  pipeline counts.

## Data Model

- Migration (next free number at implementation,
  `period11_learning_target_status`): drop + re-add the `applications.status`
  CHECK constraint including `learning_target` (additive; no data
  rewritten). No new tables, no index changes (existing status filtering
  patterns suffice at MVP scale).
- `docs/product/data-model.md` valid-values list updated; decision `0009`
  refreshed and the durable decision row updated via
  `scripts/bin/harness-cli decision add` (refresh).

## UI / Platform Impact

- Tracker page (`/tracker`): Learning Targets filter/segment, display label
  and badge with a first-use tooltip/helper ("A role you're building skills
  toward — not an active application"; "Learning Target" is product
  vocabulary and must define itself), transition affordances ("Move to
  Saved", "Archive"). Tracker list keeps the established table-list
  presentation.
- Dashboard: active-application counts exclude learning targets (tile copy
  unchanged unless a separate learning-target count is requested — period
  README open question #3).
- Job analysis page: Save as Learning Target action behavior (button
  placement owned by US-049); saved state reflects back into the action
  panel ("Saved as learning target").

## Observability

- Existing activity-feed pattern: an activity entry on learning-target save
  (reuses tracker activity conventions if present; otherwise a
  `tracker.learning_target_saved` entry). Canonical request log line via the
  existing contract.

## Alternatives Considered

1. Separate `learning_targets` table — rejected: duplicates tracker
   linkage/notes semantics for one status's worth of difference.
2. Boolean `is_learning_target` flag alongside status — rejected: two
   sources of truth for pipeline membership.
3. Tag/label system on applications — rejected as scope creep; statuses are
   the established workflow vocabulary (decision 0009).
