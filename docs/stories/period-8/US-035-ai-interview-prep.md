# US-035 AI Interview Prep

## Status

implemented — `InterviewPrepWorkflow` (Gemini + Python port of
`buildInterviewPrep` upgraded to the 7.4 schema), answer-guidance truthfulness
contract (null evidence ⇒ study/build-proof warning), weak topics from US-029,
`do_not_claim` from the US-031 snapshot, 0.6 `needs_review` bar, new
`/interview-prep` router (POST/GET/regenerate) with §5 column mapping into
`interview_preps`, page rebuilt as the 7-tab layout on a new `ui/tabs.tsx`
primitive with warning badges. No migration. Unit tests pass
(`tests/test_interview_prep_workflow.py`); backend suite green; web
tests/lint/tsc clean; live endpoint smoke → 401. Remaining: browser E2E of the
7-tab flow.

## Lane

normal

## Product Contract

For a scored match, ApplyWise generates a personalized interview preparation
package — job-specific technical, AI/LLM, system design, and behavioral
questions; a ranked weak-topics list; per-question answer guidance (recommended
angle, resume evidence, and a truthfulness warning when evidence is absent); and
a prep summary. The AI result replaces the deterministic US-011 output and is
stored in the existing `interview_preps` table. Output is regenerable and
rendered across seven tabs on the existing interview-prep page.

This is Feature 7 of `applywise_ai_assistant_update_tasks.md`. It upgrades
US-011 and depends on US-027 (foundation), US-028 (match analysis), US-029
(missing skills), and US-031 (resume suggestions). The provider boundary is
inherited from `docs/decisions/0012-ai-workflow-standards.md`; this is a
bounded normal-lane reuse, not a new provider decision.

## Relevant Product Docs

- `docs/stories/period-8/flows/US-035-ai-interview-prep-flow.md` (source of
  truth — full schemas, mermaid diagrams, prompt text, column mappings, error
  table, task checklist)
- `docs/product/ai-workflows.md`
- `docs/product/data-model.md`
- `docs/decisions/0012-ai-workflow-standards.md`

## Acceptance Criteria

- Given a match I own with candidate profile, parsed job, and match analysis
  present, when I click Generate, then an `ai_workflow_runs` row transitions
  `queued → running → completed`, an `interview_preps` row is upserted, and an
  `activity_feed` row is written.
- Given generation succeeds, then all seven tabs (Overview, Technical, AI/LLM,
  System Design, Behavioral, Weak Topics, Answer Guidance) render content
  sourced from `interview_preps` columns; the Overview tab shows `prep_summary`
  and a provider badge.
- Given a Gemini API key is configured, then the questions are specific to the
  job description and role (not generic templates), confirmed by
  `model_provider = gemini` on the run row.
- Given `missing_skill_analysis` contains weak topics, then `weak_topics_to_study`
  is populated and the Weak Topics tab shows at least those topics.
- Given the candidate has resume evidence for an answer, then
  `resume_evidence_to_use` is non-null and displayed in the Answer Guidance card.
- Given the candidate has no resume evidence for a topic, then
  `resume_evidence_to_use` is null, `warning` is a non-null study/build-proof
  instruction, and the UI renders a visible warning badge — no experience is
  implied that the candidate does not have.
- Given `gemini_api_key` is unset, when I generate, then the deterministic
  fallback runs, the run records `model_provider = deterministic`, and the tabs
  still populate.
- Given a match I do not own, when I call any endpoint, then I receive
  `error.code = unauthorized` and no run or `interview_preps` row is written.
- Given generation fails after retry, then the run row is `failed` with a typed
  `error_code`; the API returns a retryable error envelope; any previously saved
  prep result remains visible in the UI.
- Given I click Regenerate, then the workflow re-runs, the old `interview_preps`
  row is replaced, a new `ai_workflow_runs` row is written, and the tabs update.
- Given `confidence_score < 0.6`, then the run status is `needs_review` and a
  "Needs review" badge appears on the Overview tab; the result is still persisted
  and shown.

## Design Notes

- **Commands:** `InterviewPrepWorkflow(BaseAIWorkflow)`
  (`apps/api/app/services/ai/interview_prep_workflow.py`, new) with
  `workflow_type = "interview_prep"`. Pydantic models `InterviewPrepOutput` and
  `AnswerGuidanceItem` defined in the same file (or
  `apps/api/app/schemas/interview_prep.py` to match existing schema conventions).
- **Queries:** `GET /api/matches/{matchId}/interview-prep`.
- **API:** `POST /api/matches/{matchId}/interview-prep`,
  `POST /api/matches/{matchId}/interview-prep/regenerate`. Router in new
  `apps/api/app/routers/interview_prep.py`, mounted in
  `apps/api/app/main.py` with prefix `/api/matches`.
- **Tables:** reuses `interview_preps` (no new table). Output → column mapping:
  `{technical,ai_llm,system_design,behavioral}_questions` → `questions_json`;
  `weak_topics_to_study` → `weak_topics_json`; `answer_guidance` →
  `answer_guidance_json`; `prep_summary` → `study_plan_json` as
  `{ "prep_summary": "...", "study_plan": [] }` (Assumption: `study_plan_json`
  is repurposed; no migration needed). Additive columns `confidence_score` and
  `model_provider` on `interview_preps` are tentative; omit from initial
  migration pending team sign-off — authoritative values live in
  `ai_workflow_runs`. See the flow doc §5 for the full mapping table.
- **Input loading:** `load_input()` fetches `candidate_profile_json`
  (user_profiles), `structured_json` (jobs), match score columns (matches), and
  the latest `output_snapshot_json` from `ai_workflow_runs` for
  `workflow_type = missing_skills` and `workflow_type = resume_suggestions` via
  `SupabaseDataClient`.
- **Deterministic fallback:** Python port of `buildInterviewPrep` in
  `apps/web/src/lib/interview-prep-generator.mjs` implemented as
  `InterviewPrepWorkflow.deterministic_fallback()`. The original `.mjs` file is
  not deleted.
- **Confidence threshold:** `confidence_score < 0.6` → `status = needs_review`;
  `>= 0.6` → `status = completed`. On invalid JSON after one retry, invoke
  `DeterministicFallbackProvider`. If even the fallback fails Pydantic
  validation, `status = failed`, `error_code = schema_validation_failure`.
- **New `SupabaseDataClient` methods:** `upsert_interview_prep(...)` and
  `get_interview_prep_by_match(match_id, user_id)`.
- **Frontend actions:** `generateInterviewPrep(matchId)` and
  `regenerateInterviewPrep(matchId)` added to `apps/web/src/lib/actions.ts`
  using the `ai-workflow-client.mjs` `runWorkflow` helper from US-027.
- **UI surfaces:** existing
  `apps/web/src/app/(app)/matches/[matchId]/interview-prep/page.tsx` upgraded
  from US-011 card layout to 7-tab layout. Answer Guidance cards display
  question, recommended angle, resume evidence (or "No evidence found" muted),
  and a destructive/amber warning badge when `warning ≠ null`. States: empty,
  loading ("ApplyWise is preparing your interview plan…"), `needs_review` badge,
  `completed` with provider badge, `failed` with Retry when `error.retryable`.
  Routing note: brief's `/jobs/:id/interview-prep` maps to the match-centric
  route `/matches/[matchId]/interview-prep`; no job-centric route is added.
- **Domain rules:** answer guidance must never imply experience the candidate
  does not have; `resume_evidence_to_use = null` + non-null `warning` is the
  required signal. `weak_topics_to_study` must reflect `missing_skill_analysis`
  input. All prompt and schema details are in the flow doc §4.
- Full prompt preamble, Feature-7 task instruction, error code table, and dev
  task checklist are in
  `docs/stories/period-8/flows/US-035-ai-interview-prep-flow.md`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-035 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Provider selection (key set / unset); retry on invalid JSON → fallback; Pydantic validation failure → `failed`; `confidence_score < 0.6` → `needs_review`; ownership denial → `unauthorized`, no DB write; `missing_profile` / `missing_job_requirements` / `missing_match_analysis` guards; correct output-to-column mapping; no `candidate_profile_json` or `raw_description` in logs. Fake provider — no live Gemini calls. |
| Integration | `POST /interview-prep` writes `interview_preps` + `ai_workflow_runs` + `activity_feed`; regenerate replaces saved row and creates new run; `GET` returns saved prep + latest run; ownership denial; missing-match-analysis guard blocks generation. |
| E2E | Generate prep from the interview-prep page → all 7 tabs populate; warning badge visible for null-evidence guidance item; Regenerate updates tabs. |
| Platform | n/a |
| Release | Included in the Period 8 AI suite run. |

## Harness Delta

Reuses US-027 `BaseAIWorkflow`, `ai_workflow_runs` run/activity writers,
`ai-workflow-client.mjs`, and Gemini client pattern from
`apps/api/app/services/job_extractor.py`. No new decision record — provider
boundary inherited from `docs/decisions/0012-ai-workflow-standards.md`. Adds
one new router, one new workflow class, two new `SupabaseDataClient` methods,
and two new web actions. No new table migration required for the baseline;
tentative additive columns (`confidence_score`, `model_provider`) deferred to
`0011_period8_interview_prep_additive.sql` pending team sign-off.

## Evidence

Add pytest output, Playwright screenshot of the 7-tab result, and warning-badge
screenshot after validation.
