# US-032 AI Tailored Resume Markdown Draft

## Status

implemented — backend workflow + `/tailored-resume` endpoints; web action rewired
from the deterministic path to the API; reuses `resume_versions` (no migration).
Unit tests pass (`tests/test_resume_draft_workflow.py`); backend 137, web
tsc/eslint clean; live endpoint smoke → 401 (wired + auth-enforced). Remaining:
browser E2E.

## Lane

normal

## Product Contract

For a match with accepted or safe suggestions (from US-031 Truth Guard),
ApplyWise generates a job-specific Markdown resume draft that reorders,
rewrites, and emphasises the candidate's content to fit the target role.
The draft is persisted to `resume_versions`, displayed with a tailoring
summary, included/excluded suggestion lists, quality notes, and a confidence
badge. The user can copy the raw Markdown, save a named version, or regenerate.
Unsupported or pending suggestions are excluded by default with a typed reason.

This is Feature 4 of `applywise_ai_assistant_update_tasks.md` (lines 668–819).
It upgrades US-009 (deterministic scaffold) and depends on US-031 for the
`resume_suggestions` rows it consumes. It calls the external provider through
the boundary in `docs/decisions/0012-ai-workflow-standards.md` and is therefore
a bounded, normal-lane reuse rather than a new provider decision.

## Relevant Product Docs

- `docs/stories/period-8/flows/US-032-ai-tailored-resume-draft-flow.md` (full schemas, Mermaid diagrams, dev tasks)
- `docs/decisions/0012-ai-workflow-standards.md`
- `docs/stories/period-8/flows/README.md` (migration numbering)

## Acceptance Criteria

- Given a match with at least one `resume_suggestions` row where
  `user_action = 'accepted'` OR `truth_guard_status = 'Safe to use'`, when the
  user clicks Generate Draft, then the API returns a `200` envelope with a
  non-empty `resume_markdown`, an `ai_workflow_runs` row with
  `workflow_type = 'resume_draft'` and `status = 'completed'` or
  `'needs_review'`, and a `resume_versions` row is inserted.
- Given `resume_suggestions` rows with `truth_guard_status = 'Do not use yet'`,
  when a draft is generated, then those suggestions appear in
  `excluded_suggestions` with `reason = 'unsupported'` and their content does
  NOT appear in `resume_markdown`.
- Given a draft is displayed, when the user clicks Copy Markdown, then the raw
  `resume_markdown` is written to the clipboard and the button shows "Copied!"
  for 2 seconds.
- Given a draft is displayed, when the user clicks Save Version and confirms,
  then a `resume_versions` row is written with the user-chosen or auto-generated
  title and the AI metadata columns populated, and a success toast is shown.
- Given a draft is displayed, when the user views Included Suggestions, then
  each incorporated suggestion text is listed.
- Given a draft is displayed, when the user views Excluded Suggestions, then
  each excluded suggestion is shown with a human-readable reason
  (Unsupported claim / Not selected / Low confidence).
- Given a draft exists, when the user clicks Regenerate, then a new run starts,
  a new `resume_versions` row is created, the previous row is preserved, and
  the latest draft is shown on success.
- Given `GEMINI_API_KEY` is unset, when a draft is generated, then the
  deterministic fallback (`buildTailoredResumeDraft` port) runs,
  `model_provider = 'deterministic'`, the output is schema-valid, and a
  `resume_versions` row is saved.
- Given a match has no `resume_suggestions` rows, when the user attempts to
  generate, then the API returns
  `{ error: { code: 'no_suggestions', retryable: false } }` and no run or
  version row is created.
- Given the model returns `confidence_score < 0.5`, when the draft is
  displayed, then an amber "Needs review" badge and `confidence_score` are
  visible.
- Given a match not owned by the requesting user, when any tailored-resume
  endpoint is called, then `{ error: { code: 'unauthorized' } }` is returned
  and no row is written.
- Given any generation run succeeds or fails, then no raw resume text, JD text,
  or prompt body appears in emitted logs.

## Design Notes

Full schemas, Mermaid diagrams (user flow, sequence, AI processing flowchart,
ER diagram, data-flow), and concrete dev tasks are in the flow doc:
`docs/stories/period-8/flows/US-032-ai-tailored-resume-draft-flow.md`.

**Commands:**
- `TailoredResumeDraftWorkflow(BaseAIWorkflow)` in
  `apps/api/app/services/ai/tailored_resume_draft_workflow.py`.
  `workflow_type = 'resume_draft'`. Implements `load_input()`, `build_prompt()`,
  `output_model = TailoredResumeDraftOutput`, `deterministic_fallback()` (Python
  port of `buildTailoredResumeDraft` from
  `apps/web/src/lib/resume-draft-generator.mjs`), `persist()`.

**Queries:**
- `GET /api/matches/{matchId}/tailored-resume` — returns latest
  `resume_versions` row + latest `ai_workflow_runs` row for the match; null
  result fields when no draft exists.

**API:**
- `POST /api/matches/{matchId}/tailored-resume` — generate.
- `POST /api/matches/{matchId}/tailored-resume/regenerate` — regenerate
  (previous versions preserved).
- New router: `apps/api/app/routers/resume_draft.py`; mounted in
  `apps/api/app/main.py`. All endpoints use the standard US-027 envelope
  `{ workflow_run, result }`.

**Tables:**
- Reuses existing `resume_versions` (migration `0004_period3_resume_versions.sql`).
- Assumption: tentative migration `0014_period8_resume_versions_ai_columns.sql`
  adds four nullable jsonb columns to `resume_versions`:
  `tailoring_summary_json`, `included_suggestions_json`,
  `excluded_suggestions_json`, `quality_notes_json`. Migration number is
  TENTATIVE — assign the next free number at implementation time per the
  canonical list in `docs/stories/period-8/flows/README.md`.
- Existing `ai_workflow_runs` and `activity_feed` tables (US-027) used
  unchanged.
- New `SupabaseDataClient` methods in `apps/api/app/services/supabase_data.py`:
  `get_resume_suggestions_for_match`, `insert_resume_version`,
  `get_latest_resume_version`, `list_resume_versions`.

**Domain rules:**
- Suggestion filtering: `user_action = 'accepted'` OR
  `truth_guard_status = 'Safe to use'` → AI input.
  `truth_guard_status = 'Do not use yet'` OR `user_action = 'pending'` →
  `excluded_suggestions` (passed to model for reason generation).
- `confidence_score < 0.5` → `ai_workflow_runs.status = 'needs_review'`; result
  still persisted and displayed with badge.
- No raw resume text, JD text, or prompt body in logs (redacting logger from
  `apps/api/app/services/ai/logging.py`).
- PDF/DOCX export is post-MVP; the Markdown Preview component must be designed
  to accept a future "Download PDF" button without layout changes.
- Pydantic schema: `apps/api/app/schemas/resume_draft.py` —
  `ExcludedSuggestion(suggestion: str, reason: Literal['unsupported',
  'not_selected', 'low_confidence'])` and `TailoredResumeDraftOutput`.

**UI surfaces:**
- Existing page `apps/web/src/app/(app)/matches/[matchId]/resume-draft/page.tsx`
  — upgrade to §4.6 section layout (do not create a new file).
- Sections: Tailoring Summary card, Markdown Resume Preview (rendered + raw
  toggle), Included Suggestions list, Excluded Suggestions list with reason
  badge, Quality Notes list, Copy Markdown button, Save Version button,
  Regenerate button.
- States: empty (Generate Draft button + suggestion count), loading (spinner),
  success (`completed`), needs-review (amber badge + score), error (friendly
  message + Retry when `retryable`).
- Frontend client: `apps/web/src/lib/ai-workflow-client.mjs` (US-027)
  `runWorkflow(path)`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-032 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Suggestion filtering (accepted / safe / excluded); valid output → `resume_versions` + `ai_workflow_runs` + `activity_feed` rows written; invalid JSON → retry → fallback → valid; fallback path: `confidence_score = 0.0`, `model_provider = deterministic`; `no_suggestions` → 422 before run is created; ownership denial → 403 no rows; log redaction: no raw resume text in output. Fake provider, no live Gemini calls. File: `apps/api/tests/test_tailored_resume_draft_workflow.py`. |
| Integration | `POST /tailored-resume` writes `resume_versions` + run + activity; regenerate creates new version and preserves old; GET returns latest; ownership enforcement; `missing_profile` / `missing_job_requirements` guards return 422; `no_suggestions` guard. |
| E2E | Generate draft from resume-draft page → all §4.6 sections render; copy Markdown; regenerate updates display; needs-review badge shown when confidence low. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. |

## Harness Delta

Reuses US-027 `BaseAIWorkflow`, run/activity writers, envelope, and error
taxonomy. No new decision record — provider boundary inherited from
`docs/decisions/0012-ai-workflow-standards.md`. Adds one tentative migration
(additive jsonb columns on `resume_versions`), one new router
(`resume_draft.py`), and four `SupabaseDataClient` persistence helpers.
Depends on US-031 for `resume_suggestions` rows consumed at runtime.

## Evidence

Add pytest output, node test output, and a resume-draft page screenshot after
validation.
