# US-054 Analysis Decision History View

## Status

implemented (read-only history endpoint — newest-first, 20-cap with surfaced
dropped count, ownership 404; Advanced-tab history table with label transitions,
input-freshness summaries, and rules-version markers; API + web unit/integration
green; browser E2E deferred — suite-wide gap)

## Lane

normal

## Product Contract

Users can see how a job's decision evolved: each Refresh Analysis (and any
recompute) leaves a decision snapshot, and Advanced Analysis Details shows
the history — when the analysis ran, which decision it produced, the prior
decision when it changed, key scores/confidence, and which inputs (profile/
resume/job versions) were used. The user can verify that updating their
profile changed the outcome.

Covers brief Epic 13 (user story 13.1). Reads the US-047 snapshot table;
renders inside the US-051 Analysis Details surface.

## Relevant Product Docs

- `docs/product/ai-workflows.md` (decision engine + snapshots, after US-047)
- `docs/product/data-model.md` (snapshot table, after US-047)
- `docs/stories/period-11/README.md` (restatement #4)

## Acceptance Criteria

- Given an analysis is refreshed, then a new decision snapshot exists
  (US-047 behavior) and appears at the top of the history list in Analysis
  Details.
- Given the decision changed between runs, then the history entry shows both
  the previous and new decision labels (e.g. "Not Recommended → Apply With
  Improvements") with the run timestamp.
- Given the user updated their profile before refreshing, then the history
  entry's inputs summary reflects that newer profile data was used (from the
  snapshot's `inputs_snapshot_json` timestamps), in user language
  ("Used profile updated Jun 10, 2026").
- Given multiple snapshots exist, then history lists them newest-first with
  label, score, risk, confidence per entry; the list is read-only (no
  rollback), returns the most recent 20 entries, and when older entries are
  dropped the UI says how many ("12 older runs not shown") — no silent cap.
- Given adjacent snapshots carry different `rules_version` values, then the
  history shows a "decision rules updated" marker between them — a label
  change caused by rule tuning must never read as the user's fit changing
  (decision 0015 §7).
- Given only one snapshot exists, then history shows that single entry
  without a change indicator; given none exist (pre-Period 11 matches), the
  section explains history starts with the first refreshed analysis.
- Given history renders, then it lives only inside Advanced Analysis Details
  (US-051) — no history UI on the main overview surface.

## Design Notes

- Commands: none (read-only).
- Queries: `GET /api/matches/{match_id}/analysis-package/history` (route
  frozen in decision 0015 §5) returning snapshot rows newest-first with a
  sensible limit (e.g. 20, with the dropped-count surfaced — no silent cap);
  ownership enforced like other match routes.
- API: read-only addition over the US-047 table; no writes.
- Tables: none new (reads `analysis_decisions`, the US-047 snapshot table).
- Domain rules: display formatting of label transitions and input
  freshness lives in one helper; raw `inputs_snapshot_json` ids are not
  rendered — only human summaries.
- UI surfaces: history section inside the Analysis Details tab (US-051),
  presented as a compact table list (newest first), consistent with the
  product's table-list convention for history/index surfaces.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-054 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Transition rendering (changed vs unchanged), input-freshness summary from fixture timestamps, empty/single-entry states, dropped-count line at the 20-entry cap, rules-version marker between mixed-version fixtures. |
| Integration | History endpoint returns snapshots newest-first with the 20-entry limit; ownership denial; entries match persisted US-047 rows after two recomputes. |
| E2E | Refresh twice with a profile change between → history shows the transition. (Browser E2E remains the suite-wide gap.) |
| Platform | n/a |
| Release | API pytest + ruff; web `tsc`, `eslint`, `node --test`. |

## Harness Delta

None expected beyond story bookkeeping.

## Evidence

Implemented 2026-06-10.

- **Endpoint** `GET /api/matches/{id}/analysis-package/history`
  (`apps/api/app/routers/matches.py`): read-only; 404 when the match isn't owned;
  an owned match with no recompute yet returns an empty list. Backed by
  `build_decision_history` (`app/services/analysis_package.py`) which reuses the
  ownership gate, maps each `analysis_decisions` row to a `DecisionHistoryEntry`,
  and reports `returned` / `total` / `dropped`.
- **Cap + count** (`get_decision_history` in `supabase_data.py`): now returns
  `(rows, total)` via `Prefer: count=exact` (mirrors `list_activity_feed`), so the
  20-entry cap surfaces a dropped count — no silent truncation.
- **Schema** (`schemas/analysis_package.py`): `AnalysisDecisionHistory`,
  `DecisionHistoryEntry`, `DecisionHistoryInputs` (human freshness summaries from
  `inputs_snapshot_json` timestamps — raw row ids are never rendered).
- **Web** (`apps/web`): `fetchAnalysisHistory` (`ai-workflow-client.mjs`) +
  `getAnalysisHistory` and `AnalysisDecisionHistory`/`DecisionHistoryEntry` types
  (`data/server.ts`); pure helpers in `history-view.mjs`
  (`historyTransition` — changed/unchanged, never a false transition;
  `rulesVersionChanged` — the "decision rules updated" marker;
  `inputFreshnessParts`; `droppedRunsLine`); `AnalysisHistory` component (a
  newest-first **table list**, with the rules-version marker rendered between
  mixed-version rows and the dropped-count line below) mounted on the **Advanced**
  tab (`/advanced` — US-051), the only surface that shows history.
- **Tests**: `apps/api/tests/test_analysis_history_router.py` (404 ownership,
  empty/never-recomputed, newest-first + transition fields, 20-cap + dropped
  count, input-freshness summary, rules-version change between runs) +
  `apps/web/tests/history-view.test.mjs` (transition copy, rules-version marker,
  freshness parts, dropped-runs line). **API 397 passed + ruff clean; web 190
  tests, tsc + eslint clean.**
- **Scope notes**: history is read-only (no rollback — decision 0015 §7); the
  rules-version marker and transition phrasing live in one web helper. Browser E2E
  (refresh twice with a profile change → history shows the transition) remains the
  suite-wide gap.

Durable proof:
`scripts/bin/harness-cli story update --id US-054 --status implemented --unit 1 --integration 1 --e2e 0 --platform 0`.
