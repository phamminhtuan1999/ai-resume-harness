# Validation — US-047 Job Analysis Decision Engine & Unified Analysis Package

## Proof Strategy

The decision engine is pure functions proven by a rules matrix; the endpoint
is proven by composition integration tests against saved fixture rows; the
snapshot table is proven by migration apply + append-only history assertions.
No AI provider calls anywhere in this story's tests (saved rows only).

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-047 --unit 1 --integration 1 --e2e 0 --platform 0`.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Decision rules as the **ordered sequence** (design.md §DecisionRules / decision 0015 §2), asserting first-match-wins at every band boundary (34/35/59/60/79/80, integer scores) × critical-gap presence × risk level × tailoring tri-state → expected label, **with reachability assertions for every label and every clause** (incl.: ≥80-with-important-gaps → `apply_with_improvements` via rule 6; ≥60-with-critical-gap → rule 4 regardless of relevance, summary names the skill, readiness capped; high-risk-zero-gaps → rule 6 with a risk-based reason, never gap copy); **absent-input defaults as a matrix dimension** (no suggestions row → tailoring `unknown` does NOT block `strong_apply`; no insight row → risk `medium` + `module_missing`; confidence = mean of available module confidences); affinity via the **normative role-family fixture matrix** (target_role overlap / current_role fallback / both-empty → not relevant + `no_target_role` reason / **user-asserted learning-target save → always relevant**); label→display copy mapping complete; material readiness per label incl. the generated-not-reviewed gate; next-action set per label matches the **normative placement table** — all four labels, agency actions present for every label, no Refresh in any tier, `locked`/`done` states (Draft CV strategy gate, View Roadmap flip), tracker-status overrides (applied/interviewing → suppress shop-around actions, promote Prepare Interview); all nine confidence-reason codes derived from their cause; assistant-copy fallback contains no module/debug vocabulary; same inputs → identical package (determinism). |
| Integration | `GET /analysis-package` with full Period 8 fixture rows → composed package, all sections incl. `scores`, `resume`, `application`, `decision.previous` present; **GET is a pure read** (no snapshot row created by any sequence of reads); partial modules (no gaps row, no insight row) → `analysis_state: partial`, package still valid; stale via resume/job **and via `user_profiles.updated_at`** → `stale`; no analysis → 200 + `not_analyzed` + null decision; ownership denial → 404; recompute persists snapshot with `previous_label`, `scores_json`, `inputs_hash`, `rules_version`; same-inputs recompute deduplicates via `inputs_hash` (no duplicate row); **exactly-one-recompute**: a per-step regenerate triggers one recompute, an orchestrated run snapshots once at the end; label change writes one `activity_feed` entry, no entry when unchanged; append-only (no update/delete path); bounded query count (≤ 10 round trips) on the full fixture. |
| E2E | Deferred to US-048 (page renders from the package). |
| Platform | n/a |
| Performance | Package endpoint is read-only composition; assert no AI call and bounded query count on the fixture (guard against N+1 over module tables). |
| Logs/Audit | One canonical log line per request; snapshot rows carry inputs used; decision-change activity entry verified. |

## Fixtures

- Deterministic user + resume + job + match rows with saved US-028 analysis
  (scores incl. boundary values), US-029 gaps (each importance/gap_type/
  evidence_status combination represented), US-030 insight (each
  recommendation value), and absent-module variants (no suggestions row, no
  insight row — the fresh-analysis case).
- The normative role-family affinity fixture matrix: target_role set /
  empty-with-current_role / both-empty, overlapping and non-overlapping
  titles, and a user-asserted learning-target save.
- Application-row variants: none, `applied`, `interviewing` (placement
  override cases).
- A two-snapshot history fixture for previous-label and `inputs_hash`-dedupe
  assertions.

## Commands

```text
cd apps/api && .venv/bin/python -m pytest tests -q
cd apps/api && .venv/bin/ruff check
psql "$SUPABASE_DB_URL" -f apps/web/supabase/migrations/<NNNN>_period11_analysis_decisions.sql   # at implementation
```

## Acceptance Evidence

Implemented 2026-06-10.

- **Engine + adapters** (`apps/api/app/services/decision_engine.py`,
  `decision_adapters.py`): pure functions; band constants 80/60/35 and
  `RULES_VERSION = "p11.r1"` frozen in code.
- **Schemas** (`apps/api/app/schemas/analysis_package.py`); **composition +
  recompute** (`apps/api/app/services/analysis_package.py`); **endpoint**
  `GET /api/matches/{match_id}/analysis-package` + the exactly-one-recompute
  hook in `apps/api/app/routers/matches.py`.
- **Migration** `apps/web/supabase/migrations/0020_period11_analysis_decisions.sql`
  applied to the live DB via `psql "$SUPABASE_DB_URL"` (CREATE TABLE / INDEX /
  ALTER TABLE); all 19 columns present; PostgREST `GET /analysis_decisions`
  returns HTTP 200 (table exposed, RLS permits the service role).
- **Tests**: `tests/test_decision_engine.py` (57 cases — rules matrix with
  boundary + reachability + absent-input dimensions, the normative role-family
  affinity matrix, placement table, all nine confidence codes, determinism,
  adapters) and `tests/test_analysis_package_router.py` (17 cases — composed
  GET, pure-read-no-write, ETag/304, partial + stale-by-profile-edit + 
  not_analyzed states, ownership 404, recompute identity/dedupe/previous +
  activity-on-change, exactly-one-recompute on regenerate and run-full, ≤10
  round-trip bound). Full API suite: **377 passed**; `ruff check` clean.
- **Deferred**: browser E2E (suite-wide gap, picked up by US-048 which renders
  the package).

Durable proof recorded via
`scripts/bin/harness-cli story update --id US-047 --status implemented --unit 1 --integration 1 --e2e 0 --platform 0`.
