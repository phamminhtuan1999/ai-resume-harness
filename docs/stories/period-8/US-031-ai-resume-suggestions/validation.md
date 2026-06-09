# Validation

## Proof Strategy

The feature is done when, for a fixture resume + job with a pre-existing match
analysis run, Gemini output is validated into `ResumeSuggestionOutput`, Truth
Guard enum values are mapped to stored title-case display values, `resume_suggestions`
rows are upserted, the full snapshot is stored in `ai_workflow_runs.output_snapshot_json`,
an `activity_feed` event is written, the page renders all six sections with
per-row Accept/Reject/Edit, regenerate replaces rows and creates a new run, and
the deterministic fallback produces schema-valid output when the provider is
unavailable. Unit tests use a fake provider; no live Gemini calls.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Truth Guard mapping for all three values (`safe_to_use`/`needs_confirmation`/`do_not_use_yet` → title-case); `match_analysis_required` raised when no completed match_analysis run; deterministic fallback (`_deterministic_resume_suggestions`) maps JS `buildResumeSuggestions` logic into a schema-valid `ResumeSuggestionOutput`; retry-then-fallback chain on invalid JSON; `confidence_score < 0.6` → `needs_review`; ownership denial; schema-validation failure → US-027 typed error. |
| Integration | `POST .../resume-suggestions` writes `resume_suggestions` rows + `ai_workflow_runs(completed)` + `activity_feed`; `match_analysis_required` returns 422 with no rows written; `upsert_resume_suggestions` deletes old rows before inserting new; regenerate creates a second run and replaces rows; `GET` returns snapshot fields + rows; PATCH sets `user_action` and optionally `suggested_text`; ownership denial (403) on all four endpoints. |
| E2E | Generate from the match suggestions page → see strategy card, six sections, Truth Guard badges; accept a safe row → visual accepted state; reject a row → dimmed; edit a needs-confirmation row → saved text + accepted state; regenerate with confirmation modal → fresh results. |
| Platform | n/a. |
| Performance | `latency_ms` populated; page renders persisted data without re-calling the model. |
| Logs/Audit | No `original_resume_text` or raw JD content in emitted log lines for success and failure runs. |

## Fixtures

- Backend-engineer resume + AI-Engineer JD with RAG/vector requirements (true
  gaps), clear FastAPI/API experience (safe strengths), and mid-senior seniority;
  with a pre-inserted completed `match_analysis` `ai_workflow_runs` row.
- `FakeGeminiProvider` outputs: mix of all three Truth Guard statuses, a
  `do_not_use_yet` suggestion without evidence, a `needs_confirmation` suggestion
  with partial evidence, `confidence_score = 0.81` (normal) and `0.45`
  (`needs_review`) variants.

## Commands

```text
pytest apps/api/tests/test_resume_suggestions_workflow.py
node --test apps/web/tests/resume-suggestions.test.mjs
```

Record proof with:
`scripts/bin/harness-cli story update --id US-031 --unit 1 --integration 1 --e2e 0 --platform 0`

## Acceptance Evidence

Add pytest/node output and a screenshot of the upgraded suggestions page showing
the strategy card, at least one suggestion from each Truth Guard section, and an
accepted row after the PATCH round-trip.
