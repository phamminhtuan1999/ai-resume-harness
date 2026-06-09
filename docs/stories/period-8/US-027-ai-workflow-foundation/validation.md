# Validation

## Proof Strategy

The foundation is proven when the standard flow runs end-to-end through one
reference workflow (match analysis) with both providers, persists a run +
activity row, enforces ownership, redacts sensitive text, and degrades to the
deterministic fallback without breaking shipped match generation. Unit tests
must not make live model calls — Gemini is exercised through a fake provider
returning canned structured output and canned failures.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Provider selection (key present → Gemini, absent → fallback); retry-once on invalid JSON then success; terminal provider error → deterministic fallback with schema-valid output; Pydantic schema-validation failure → typed `schema_validation_failure`; low confidence → `needs_review`; error taxonomy maps each failure to the right code + `retryable` flag; log redaction helper strips resume/JD text. |
| Integration | `POST /api/matches/{matchId}/analyze` happy path writes a `matches` result + `ai_workflow_runs` (completed) + `activity_feed` row; ownership: another user's `matchId` → `unauthorized`, no run written; provider outage → run `failed`, friendly retryable error, no partial domain write; `GET /api/matches/{matchId}/ai-workflow` returns latest run per `workflow_type`. |
| E2E | Existing match generation flow still works end-to-end through the new endpoint; match detail renders persisted scores; regenerate creates a new run and updates the saved result. |
| Platform | n/a (no shell/mobile/desktop change). |
| Performance | Run latency recorded in `latency_ms`; assert it is populated and non-negative. |
| Logs/Audit | Assert no `raw_text`/`raw_description`/prompt body appears in emitted log lines for a successful and a failed run. |

## Fixtures

- A deterministic `user_profiles` row, one `resumes` row, one `jobs` row with
  `raw_description`, and a `matches` shell for the subject.
- `FakeGeminiProvider` returning: (a) valid structured output, (b) invalid JSON
  once then valid, (c) terminal error, (d) low-confidence output.
- A second user's match for the ownership-denial case.

## Commands

Add after backend test scaffolding exists (pytest in `apps/api`, node test
runner in `apps/web`).

```text
# apps/api
pytest apps/api/tests/test_ai_workflow_foundation.py
# apps/web (envelope client)
node --test apps/web/tests/ai-workflow-client.test.mjs
```

Record proof with:
`scripts/bin/harness-cli story update --id US-027 --unit 1 --integration 1 --e2e 0 --platform 0`

## Acceptance Evidence

Add pytest/node output, migration apply log, and a redacted sample log line
after verification.
