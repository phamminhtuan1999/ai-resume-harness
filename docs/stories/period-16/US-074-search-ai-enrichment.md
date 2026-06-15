# US-074 Cost-Safe AI Enrichment of Search Results (Relevance + Quick Match)

## Status

planned

## Lane

normal (stronger validation — bounded AI cost contract)

## Product Contract

Search results are enriched with the two distinct AI judgments — **AI Role
Relevance** (US-072) and a **Candidate Quick Match preview** (the existing
`quick_match` workflow, US-068) — under a strict cost ceiling. The pipeline runs
AI relevance only on the top pre-filtered jobs, then quick match only on the top
relevant jobs, so a 50-result search costs a bounded, predictable number of
model calls. Each enriched job carries its relevance label, transition
friendliness, recommended action, quick-match score/label, and a short assistant
summary, ready for the results UI (US-075).

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 6, Section 14, 15)
- `apps/api/app/services/ai/quick_match_workflow.py` (reused quick match)
- `docs/stories/period-16/US-072-ai-role-relevance-classifier.md`

## Acceptance Criteria

- The `search-ai` response is extended so each surfaced job includes an
  `ai_relevance` object (US-072 schema) and, for jobs that pass relevance, a
  `quick_match` object (`preview_match_score`, `match_label`,
  `assistant_preview`, `recommended_action` per Section 15).
- Cost-safe pipeline (Section 14) is enforced and proven: fetch ≤50 → local
  pre-filter all → AI relevance on top ~20 → keep jobs ≥ relevance threshold →
  quick match on top ~5-8. Limits are server-side config; the client cannot
  raise them.
- Quick match runs **pre-save** here (no `jobs` row yet): the existing
  `QuickMatchWorkflow` is adapted to accept a normalized job payload +
  candidate profile, not only a saved job id. No second quick-match workflow is
  created.
- Jobs below the relevance threshold are excluded from the default result set
  but retain their `exclude_reason` so US-075 can reveal them under "show hidden
  jobs".
- If quick match fails or there is no candidate profile, the job still returns
  with relevance only and a "match preview unavailable" marker (Epic 6.1) — the
  result is never dropped because of a preview failure.
- Reuse (US-067) applies to both relevance and quick match so repeated searches
  over the same listings do not re-spend model calls unnecessarily.

## Design Notes

- Commands: none new (reuses US-072 + US-068 run paths).
- Queries: reads candidate profile for quick match; correlates by
  `search_session_id` from US-073.
- API: extends `POST /api/jobs/search-ai` response (same endpoint), adding the
  enrichment stage in `apps/api/app/services/job_search/`.
- Tables: none (still transient until Save in US-077); runs recorded in
  `ai_workflow_runs`.
- Domain rules: relevance gates quick match; both bounded by config; AI
  relevance ≠ candidate match must remain visibly separate in the payload.
- UI surfaces: none (US-075 renders this).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-074 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Pipeline ordering + threshold filtering; recommended-action mapping; "preview unavailable" path; selection of top-N for relevance and top-M for quick match. |
| Integration | Counting fake client asserts ≤N relevance calls and ≤M quick-match calls per search; reuse hits avoid re-calls; missing-profile path returns relevance-only; provider/AI failure leaves results renderable. |
| E2E | Via US-075: enriched cards show relevance + quick match; hidden jobs revealable. |
| Platform | n/a |
| Release | Per-search model-call budget is bounded and asserted; no unbounded fan-out. |

## Harness Delta

Intake #51. Tied to decision 0024 (cost-safe pipeline thresholds). If quick
match's pre-save adaptation changes its reuse identity, note it against
decision 0022/0023.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
