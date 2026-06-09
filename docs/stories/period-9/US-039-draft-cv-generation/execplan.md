# Exec Plan

## Goal

A validated, guarded, versioned draft-CV generation pipeline reachable at
match-scoped endpoints, with schema-identical fallback — so US-040/041/042 can
build review and export on stable data.

## Scope

In scope:

- Migration `0018_period9_draft_cvs.sql`: `draft_cvs` table + extend the
  `ai_workflow_runs.workflow_type` CHECK with `'draft_cv'` (edit in place per
  `docs/stories/period-8/flows/README.md` numbering rule; verify `0018` is
  still the next free number at implementation time).
- `DraftCvOutput` Pydantic schema (+ nested models, bullet `max_length=240`).
- `DraftCvWorkflow(BaseAIWorkflow)` with protocol prompt + standard preamble.
- Server guards: metrics guard, keyword-support guard, XYZ/ATS lint.
- Deterministic verbatim-copy fallback provider path.
- Persistence helpers + endpoints (generate / regenerate / get latest+versions
  / get by id) with ownership enforcement and the standard envelope.
- Status derivation (`needs_review` / `ready_to_export`) and activity event.

Out of scope:

- All UI; export endpoints/rendering; approval PATCH; product-doc surfaces
  beyond those listed in overview.md.

## Risk Classification

Risk flags:

- Data model (new table + CHECK constraint change on a shared table).
- External systems (Gemini provider call).
- Public contracts (four new API routes + response envelope payloads).
- Multi-domain (matches, resumes, jobs, profiles, suggestions read together).
- Weak proof (guards are novel logic with no existing tests).

Hard gates:

- External provider behavior; data migration. → high-risk lane.

## Work Phases

1. Discovery: re-read `base_workflow.py`, `resume_suggestions_workflow.py`,
   `resume_draft_workflow.py`, migration `0010`; confirm next migration number.
2. Design: freeze `DraftCvOutput` field-for-field against `design.md`; freeze
   guard semantics (token rules, lexicon source, demotion behavior).
3. Validation planning: write the unit-test list from `validation.md` first.
4. Implementation: migration → schema → workflow → guards → fallback →
   persistence → router → wiring in `main.py`.
5. Verification: pytest suite; live keyless smoke (fallback path); REST smoke
   401 unauthenticated; `harness-cli story update` proof booleans.
6. Harness update: data-model/ai-workflows docs current; trace recorded;
   friction → backlog.

## Stop Conditions

Pause for human confirmation if:

- The `workflow_type` CHECK cannot be safely altered in place (existing rows
  rejected) — would need a different migration strategy.
- Guard demotion (invented metrics → `do_not_use_yet`) proves too lossy in
  real outputs and hard-failure looks preferable (decision 0013 §2 changes).
- Any need to weaken foundation rules (logging, envelope, fallback) appears.
- Bullet `max_length` retries exhaust against real Gemini output repeatedly
  (schema/prompt mismatch suggests redesign, not looser validation).
