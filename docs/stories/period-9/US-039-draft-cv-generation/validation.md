# Validation

## Proof Strategy

Backend-only story: prove with pytest using deterministic provider fixtures
(no live Gemini), mirroring `tests/test_resume_draft_workflow.py` /
`tests/test_ai_workflow_foundation.py` patterns and the shared fakes in
`tests/ai_fakes.py`. The three guards are pure functions — test them
exhaustively at unit level. Endpoint behavior, persistence, run/activity rows,
and ownership at integration level via the FastAPI test client. Live keyless
smoke proves the fallback path end-to-end. Record proof with
`scripts/bin/harness-cli story update --id US-039 --unit 1 --integration 1
--e2e 0 --platform 0` only after the listed cases pass.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Guards: invented numeral → bullet demoted `do_not_use_yet` + `invented_metric` note; source metric preserved verbatim → no note; source metric missing from output → `metric_dropped` note, no demotion; currency/percent/magnitude token classes; unsupported skill/keyword → moved to `keywords_excluded('unsupported')`; supported keyword stays; lint: non-lexicon first word → `weak_action_verb`; >2 lint notes → `needs_review`; bullet >240 chars → schema validation failure → retry → fallback. Status derivation: pending `needs_confirmation` → `needs_review`; none pending + confidence ≥0.5 → `ready_to_export`; confidence <0.5 → `needs_review`. Bullet ids assigned, unique, stable through persist. Fallback: schema-valid, all bullets verbatim ⇒ `safe_to_use`, `confidence 0.0`, `provider deterministic`. Contact fields null when absent (never invented). |
| Integration | POST generate: 200 envelope, `draft_cvs` row v1, run row `workflow_type='draft_cv'` completed/needs_review, activity event written; regenerate → v2 inserted, v1 preserved, approvals not copied; GET latest returns newest + versions list; GET by id ownership-checked; foreign user → `unauthorized`, zero rows; no match analysis → 422 `missing_match_analysis`, **no draft row** (the foundation inserts the run row before `load_input`, so a `failed` run row exists — matching the US-033 cover-letter precondition convention; asserted in `test_requires_saved_match_analysis`); missing-skill analysis absent → still 200; migration applies on a fresh database and existing `ai_workflow_runs` rows survive the CHECK swap. |
| E2E | Deferred to US-040 (no UI in this story). |
| Platform | n/a |
| Performance | Single generation ≤ existing match-analysis latency envelope (one provider call); no N+1 loads in `load_input`. |
| Logs/Audit | Captured log output for a full run contains no resume text, JD text, bullet text, or prompt body; run + activity rows present for success and failure paths. |

## Fixtures

- Seeded profile with `candidate_profile_json` (skills incl. "Python",
  "REST"), contact columns, one resume (`raw_text` containing "Reduced p95
  latency by 38%" and "$1.2M"), one job (`extraction_json` with required
  ["Python", "Kubernetes"], preferred ["Terraform"]), one match with
  `analyzed_at` set, optional `missing_skill_analyses` row, two
  `resume_suggestions` rows (one accepted, one `Do not use yet`).
- Fake provider responses: valid output; output with invented "47%"; output
  with unsupported "Kubernetes" skill claim; output with weak verbs; invalid
  JSON then valid (retry path); terminal failure (fallback path).

## Commands

```text
cd apps/api && pytest tests/test_draft_cv_workflow.py -q
cd apps/api && pytest -q          # full suite stays green
scripts/bin/harness-cli story verify US-039   # after --verify is configured
```

## Acceptance Evidence

Add pytest output, the keyless live-smoke transcript (fallback provider), and
the migration apply log after verification.
