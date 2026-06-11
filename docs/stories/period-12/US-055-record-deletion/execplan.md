# Exec Plan — US-055 Resume and Job Deletion

## Goal

Permanent, owner-scoped, audited deletion of resumes and jobs behind an
inline destructive confirmation that states the blast radius.

## Scope

In scope:

- `deleteResumeAction` and `deleteJobAction` server actions.
- Pure helpers in `deletion-view.mjs` for confirm copy and typed-confirm
  validation (shared with US-056).
- `DeleteRecordButton` client component (inline two-step confirm, follows the
  `GenerateAnywayAction` pattern).
- Cascade-count fetch (`getResumeDeletionImpact` / `getJobDeletionImpact`).
- `activity_feed` audit rows `resume.deleted` / `job.deleted`.
- Header placement on `resumes/[resumeId]` and `jobs/[jobId]` pages.

Out of scope:

- Account deletion (US-056).
- Any schema change — the FK cascade graph is the mechanism.

## Risk Classification

Risk flags:

- Data model (deletion, retention).
- Authorization (ownership checks on the service-role client).
- Audit/security (audit rows, PII purge).
- Existing behavior (detail pages change).

Hard gates:

- Data loss — confirmed by the human owner via intake #44 and decision 0016.

## Work Phases

1. Discovery — mutation conventions, FK graph, audit surface (done; see
   design.md).
2. Design — decision 0016 + this folder.
3. Validation planning — validation.md.
4. Implementation — helpers, actions, component, page wiring.
5. Verification — unit + lint + types + Playwright E2E with DB readback.
6. Harness update — story status, matrix proofs, trace against intake #44.

## Stop Conditions

Pause for human confirmation if:

- A cascade turns out to delete rows the owner did not approve (anything
  outside the documented graph).
- Ownership scoping cannot be enforced for any path.
- Validation must be weakened to land the story.
