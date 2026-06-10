# Exec Plan — US-047 Analysis Package & Decision Engine

## Goal

One server-computed decision per match, one composed analysis-package read
model feeding the whole Period 11 UI, and an append-only decision history —
without touching the module generation pipelines.

## Scope

In scope:

- Decision engine module (pure functions): label, risk, material readiness,
  next-action list, confidence reasons.
- `GET /api/matches/{match_id}/analysis-package` composition endpoint.
- Decision-snapshot persistence (new table + migration) written on every
  recompute, with previous-label linkage.
- Profile-completeness and job-description-quality checks used as confidence
  inputs.
- Schema + persistence helpers in `apps/api/app/services/supabase_data.py`,
  Pydantic schemas under `apps/api/app/schemas/`.
- Unit + integration tests; product-doc updates; refresh durable decision row
  for `0015` (the markdown record already exists, authored at slicing).

Out of scope:

- Any UI (US-048, US-049, US-051, US-053, US-054).
- Refresh orchestration endpoint (US-050) — but the recompute function it
  calls is built here.
- Tracker `learning_target` status (US-052).
- Changes to module workflows, prompts, providers, or Truth Guard.

## Risk Classification

Risk flags:

- Data model: new decision-snapshot table + migration.
- Public contracts: new client-visible endpoint and response envelope that
  the whole Period 11 UI builds on.
- Existing behavior: the user-facing verdict moves from the US-030 insight
  card semantics to the decision engine.
- Multi-domain: reads matches, gaps, insights, suggestions, drafts, cover
  letters, workflow runs.
- Weak proof: no tests exist for cross-module composition today.

Hard gates:

- Data model migration → high-risk lane regardless of flag count.

## Work Phases

1. Discovery: confirm saved-row shapes for every module read by the package;
   confirm score/risk/confidence semantics from US-028/US-029/US-030.
2. Design: freeze decision rules table, package schema field names, snapshot
   table DDL; confirm against the accepted decision record `0015` (labels, rule
   precedence, affinity heuristic, placement table, endpoint names, snapshot
   schema all frozen there).
3. Validation planning: enumerate the rules matrix (all bands × gap/risk
   overrides) and integration cases before code.
4. Implementation: decision engine → schemas → persistence → endpoint.
5. Verification: pytest suites, ruff, migration applied via `psql` +
   `SUPABASE_DB_URL`, REST-reachability check.
6. Harness update: story status/proof in the durable matrix, product docs,
   trace with intake linkage.

## Stop Conditions

Pause for human confirmation if:

- The decision-rule bands or overrides need to differ from the brief's
  numbers to avoid absurd verdicts on real data.
- The package schema requires breaking an existing client-visible response.
- Snapshot storage suggests retention/PII concerns beyond per-user cascade
  delete.
- The insight card's stored `recommendation` turns out to be load-bearing for
  another surface (dashboard, activity feed) in a way that conflicts with the
  new labels.
