# Overview — US-052 Learning Target Tracker Flow

## Status

planned

## Lane

high-risk

## Current Behavior

The tracker (`applications` table, `/tracker` page, US-012) supports six
statuses: `saved | applied | interviewing | offer | rejected | archived`
(decision `0009`). A weak-but-relevant job has no first-class home: the user
either saves it like any application candidate (polluting pipeline counts) or
loses it. Roadmaps (US-034) exist per match but have no link to a "study this
role" intent.

## Target Behavior

Weak-but-directionally-relevant roles become **learning targets**:

- A new tracker status value `learning_target` (additive migration to the
  `applications.status` CHECK constraint; decision `0009` refreshed).
- "Save as Learning Target" is the primary action for `learning_target`
  decisions (rendered by US-049); saving creates/updates the tracker row with
  status `learning_target` and match linkage.
- Learning targets are not counted as active applications: dashboard and
  tracker pipeline counts exclude them; the tracker gains a Learning Targets
  filter/segment with its own display label.
- Generate 4-Week Roadmap is the companion primary action; a roadmap
  generated from a learning target focuses on closing the missing critical
  skills (existing US-034 workflow already consumes the gap analysis — no
  prompt change required; the linkage is navigational and contextual).
- Status transitions: a learning target can later move to `saved`/`applied`
  (when the user decides to apply after improving) or `archived`; pipeline
  statuses can move to `learning_target` only via explicit user choice.

Covers brief Epic 9 (user story 9.1).

## Affected Users

- Job seeker: can keep weak roles as skill-building references without
  polluting their application pipeline.

## Affected Product Docs

- `docs/product/data-model.md` (`applications.status` values)
- `docs/product/overview.md` (tracker semantics)
- `docs/decisions/0009-application-tracker-status-values.md` (refresh with
  the new value — durable decision update required)
- `docs/decisions/0015-job-analysis-decision-engine.md` (§8 learning target,
  §4 Save as Reference → `archived`)

## Non-Goals

- New tables or a separate learning-target entity (it is a tracker status).
- Changing roadmap generation prompts or workflow (US-034 unchanged).
- Auto-classification of saved jobs into learning targets (only explicit
  user action sets the status; the decision engine only recommends).
- Reminders/scheduling around learning targets.
