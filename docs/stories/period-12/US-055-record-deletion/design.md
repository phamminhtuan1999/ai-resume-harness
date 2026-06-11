# Design — US-055 Resume and Job Deletion

## Domain Model

A resume or job is deletable only by its owner. Deletion is a single atomic
statement whose blast radius is defined entirely by the existing FK graph:

```text
resumes ─┬─ matches (cascade) ─── all match-scoped analyses (cascade):
         │     resume_suggestions, draft_cvs, roadmaps, interview_preps,
         │     assistant_insights, missing_skill_analyses, cover_letters,
         │     resume_versions, analysis_decisions
         ├─ draft_cvs.resume_id (set null — drafts of other matches survive)
         └─ user_profiles.profile_source_resume_id (set null)

jobs ────┬─ matches (cascade) ─── same analysis cascade as above
         ├─ applications (cascade — tracker rows die with the job)
         ├─ resume_versions (cascade)
         └─ cover_letters.job_id / draft_cvs.job_id /
            activity_feed.related_job_id (set null)
```

No schema migration: the graph above is live (verified against the
information_schema on 2026-06-10).

## Application Flow

1. Detail page server-renders cascade counts
   (`getResumeDeletionImpact(resumeId)` → matches;
   `getJobDeletionImpact(jobId)` → matches + applications) with owner-scoped
   queries.
2. `DeleteRecordButton` (client) renders an outline destructive button; first
   activation expands the inline confirm with the blast-radius sentence from
   `deletion-view.mjs`; second activation submits the server action via
   `useActionState`.
3. `deleteResumeAction` / `deleteJobAction`:
   - `requireWritableContext()` resolves the owner's `user_profile_id`.
   - Reads the row title scoped by `id` + `user_id`; missing → failure
     "not found", nothing deleted.
   - Inserts the `activity_feed` audit row (`resume.deleted` /
     `job.deleted`, importance `high`, title naming the record, description
     stating the cascade counts). Audit insert failure aborts the delete —
     an unaudited destructive write is worse than a retry.
   - Deletes scoped by `id` + `user_id`.
   - `revalidatePath` for the list page and dashboard, returns
     `successWithRedirect` to the list page.
4. `FormSuccessPopup` shows the success state and performs the redirect
   (existing pattern).

## Interface Contract

Server actions (no new HTTP API surface — matches every other CRUD mutation):

- `deleteResumeAction(prev, formData{resume_id})` → `ActionState`
- `deleteJobAction(prev, formData{job_id})` → `ActionState`

Failures: missing/foreign id → "Resume/Job not found."; Supabase error →
"Delete failed." Both leave data untouched.

## Data Model

No DDL. Retention per decision 0016: purge at deletion time, audit feed row
retained for the life of the account.

## UI / Platform Impact

- `resumes/[resumeId]` and `jobs/[jobId]` header action rows gain the Delete
  control; confirm copy states permanence and the cascade counts.
- List pages and dashboard counts update via revalidation.

## Observability

`activity_feed` rows `resume.deleted` / `job.deleted` (importance `high`)
record what was deleted, when, and how many dependent records died with it.
They surface in the existing AI activity feed UI and survive until account
deletion.

## Alternatives Considered

1. FastAPI DELETE endpoints — rejected; CRUD mutations are server actions in
   this codebase, and adding an API path would duplicate auth context.
2. Soft delete — rejected by the owner (decision 0016).
3. Audit row after delete — rejected; ordering audit-first makes a silent
   unaudited deletion impossible.
