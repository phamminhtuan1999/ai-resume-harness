# Validation

## Proof Strategy

The analyzer is done when, for a fixture resume + job, Gemini output is validated
into the Feature 1.4 schema, scores are reconciled to the accepted weighting,
strengths without evidence are dropped, gaps are typed, the result is persisted
to `matches` with a run + activity row, the match page renders every section,
regenerate creates a new run, and the deterministic fallback produces a
schema-valid analysis when the provider is unavailable. Unit tests use a fake
provider; no live model calls.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `overall_score` recomputed exactly from sub-scores + weights; score→label mapping at band boundaries (39/40, 59/60, 74/75, 89/90); strength with empty `resume_evidence` removed; gap `gap_type` preserved through validation; recommendation present for each band; deterministic fallback maps `match-analyzer.mjs` output into the schema with no invented evidence; schema-validation failure → US-027 typed error. |
| Integration | `POST /analyze` writes `matches` AI columns + `ai_workflow_runs(completed)` + `activity_feed`; `missing_profile` / `missing_job_requirements` return friendly retryable errors and write no analysis; `regenerate` creates a second run and overwrites saved analysis; ownership denial; `GET /match-analysis` returns saved result. |
| E2E | Generate analysis from the match page → see assistant summary, apply badge, per-score explanations, strengths with evidence, inline gaps, risks, next best action; regenerate updates the page. |
| Platform | n/a. |
| Performance | `latency_ms` populated; analysis page reads persisted data without re-calling the model. |
| Logs/Audit | No resume/JD text in logs for success and failure runs. |

## Fixtures

- Backend-engineer resume + an AI-Engineer JD that requires RAG/embeddings
  (true gaps), mentions backend/API (strengths), and is mid-senior.
- `FakeGeminiProvider` outputs: well-evidenced strengths, one evidence-less
  "strength" (must be dropped), mixed gap types, low-confidence variant.

## Commands

```text
pytest apps/api/tests/test_match_analysis_workflow.py
node --test apps/web/tests/match-analysis-page.test.mjs
```

Record proof with:
`scripts/bin/harness-cli story update --id US-028 --unit 1 --integration 1 --e2e 0 --platform 0`

## Acceptance Evidence

Add pytest/node output and a screenshot of the upgraded match page after
verification.
