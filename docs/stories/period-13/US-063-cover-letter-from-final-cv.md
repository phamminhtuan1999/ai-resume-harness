# US-063 Cover Letter Generated from the Final Tailored CV

## Status

planned

## Lane

normal

## Product Contract

The cover letter is generated from the **final Tailored CV** (its renderable
content) plus the match analysis — not from the raw resume — so the letter can
only reference claims that survived the truth guard and matches the document
the candidate actually submits. If no tailored CV exists yet, the generator
says so and points to the Tailored CV step instead of silently using the raw
resume.

## Relevant Product Docs

- `docs/decisions/0019-single-tailored-cv.md`
- US-033 cover letter story (period-9)

## Acceptance Criteria

- `CoverLetterWorkflow.load_input` consumes the latest draft_cvs version's
  renderable content (summary, skills, bullets) instead of raw resume text;
  analysis/profile inputs unchanged.
- With no draft CV for the match, generation returns the existing guided-error
  pattern ("Generate the Tailored CV first") rather than falling back to the
  raw resume.
- Regenerating the CV does not silently invalidate an existing letter; the
  letter card shows "generated from CV version N" and flags when a newer CV
  version exists.
- Letter content references only renderable claims (prompt constraint +
  deterministic fallback built from renderable bullets only).
- Full-workflow orchestrator ordering: cover_letter's dependency gains the
  draft CV step or the orchestrator skips the letter with a "blocked" outcome
  when no CV exists (consistent with existing blocked semantics).

## Design Notes

- API: change is confined to `cover_letter_workflow.py` input loading + prompt,
  plus orchestrator manifest dependency update. The draft CV is fetched via the
  existing draft_cvs data access.
- cv_version linkage: store `source_draft_cv_id`/version on the letter row
  (additive column or JSON field per existing letter storage shape).
- UI: letter card staleness hint ("CV updated since this letter").

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Renderable-content extraction for the prompt; staleness comparison. |
| Integration | API: letter generation with/without a draft CV; deterministic fallback uses only renderable bullets; orchestrator blocked-outcome path. |
| E2E | Seeded match: generate CV → letter; letter card shows version linkage; regenerate CV → staleness hint appears. |
| Platform | n/a |

## Harness Delta

Intake #47, decision 0019. Orchestrator manifest change documented (the
US-038 module gains a dependency edge).

## Evidence

Added after verification.
